import mongoose from 'mongoose';
import { UploadDocumentService } from './../controllers/storage.upload.service';
import { StorageServiceAdapter } from '../adapter/base-storage.adapter';
import { Router, Response, NextFunction } from 'express';
import { Container } from 'inversify';
import { ValidationMiddleware } from '../../../libs/middlewares/validation.middleware';
import { AuthMiddleware } from '../../../libs/middlewares/auth.middleware';
import { StorageService } from '../storage.service';
import {
  Document,
  FilePayload,
  StorageServiceResponse,
  StorageVendor,
} from '../types/storage.service.types';
import { DocumentModel } from '../schema/document.schema';
import {
  BadRequestError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
} from '../../../libs/errors/http.errors';
import {
  AzureBlobStorageConfig,
  LocalStorageConfig,
  S3StorageConfig,
} from '../config/storage.config';
import { AuthenticatedUserRequest } from '../../../libs/middlewares/types';
import {
  DocumentInfoResponse,
  getBaseUrl,
  getDocumentInfo,
  getStorageVendor,
  hasExtension,
  isValidStorageVendor,
} from '../utils/utils';
import { HTTP_STATUS } from '../../../libs/enums/http-status.enum';
import { extensionToMimeType, getMimeType } from '../mimetypes/mimetypes';
import path from 'path';
import { Logger } from '../../../libs/services/logger.service';
import { metricsMiddleware } from '../../../libs/middlewares/prometheus.middleware';
import {
  UploadNewSchema,
  DocumentIdParams,
  GetBufferSchema,
  CreateDocumentSchema,
  UploadNextVersionSchema,
  RollBackToPreviousVersionSchema,
  DirectUploadSchema,
  DocumentIdParamsWithVersion,
} from '../validators/validators';
import { storageEtcdPaths } from '../constants/constants';
import { ConfigurationManagerServiceCommand } from '../../../libs/commands/configuration_manager/cm.service.command';
import { HttpMethod } from '../../../libs/enums/http-methods.enum';
import { KeyValueStoreService } from '../../../libs/services/keyValueStore.service';
import { FileProcessorFactory } from '../../../libs/middlewares/file_processor/fp.factory';
import { FileProcessingType } from '../../../libs/middlewares/file_processor/fp.constant';
import { FileBufferInfo } from '../../../libs/middlewares/file_processor/fp.interface';
import { ErrorMetadata } from '../../../libs/errors/base.error';
import { serveFileFromLocalStorage } from '../utils/utils';
import { DefaultStorageConfig } from '../../tokens_manager/services/cm.service';

const logger = Logger.getInstance({ service: 'StorageRoutes' });

// TODO: Remove these globals
let storageConfig:
  | AzureBlobStorageConfig
  | LocalStorageConfig
  | S3StorageConfig
  | null = null;

async function getOrSetDefault(
  keyValueStoreService: KeyValueStoreService,
  key: string,
  defaultValue: string,
) {
  const value = await keyValueStoreService.get<string>(key);
  if (!value) {
    await keyValueStoreService.set(key, defaultValue);
    return defaultValue;
  }
  return value;
}

async function getStorageConfig(
  req: AuthenticatedUserRequest,
  keyValueStoreService: KeyValueStoreService,
  defaultConfig: DefaultStorageConfig,
) {
  if (storageConfig != null) {
    return storageConfig;
  }
  const endpoint = await getOrSetDefault(
    keyValueStoreService,
    storageEtcdPaths.endpoint,
    defaultConfig.endpoint,
  );
  const token = req.headers.authorization?.split(' ')[1];
  const configurationManagerServiceCommand =
    new ConfigurationManagerServiceCommand({
      uri: `${endpoint}/api/v1/configurationManager/storageConfig`,
      method: HttpMethod.GET,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
  storageConfig = (await configurationManagerServiceCommand.execute()).data;
  return storageConfig;
}

async function watchStorageType(keyValueStoreService: KeyValueStoreService) {
  await keyValueStoreService.watchKey(storageEtcdPaths.storageType, () => {
    logger.debug('storageType changed');
    storageConfig = null;
  });
}

export function createStorageRouter(container: Container): Router {
  const router = Router();
  const defaultConfig = container.get<DefaultStorageConfig>('StorageConfig');
  const keyValueStoreService = container.get<KeyValueStoreService>(
    'KeyValueStoreService',
  );
  const authMiddleware = container.get<AuthMiddleware>('AuthMiddleware');
  watchStorageType(keyValueStoreService);

  const initializeStorageAdapter = async (
    req: AuthenticatedUserRequest,
  ): Promise<StorageServiceAdapter> => {
    storageConfig = await getStorageConfig(
      req,
      keyValueStoreService,
      defaultConfig,
    );
    if (!storageConfig) {
      throw new InternalServerError('Storage configuration not found');
    }
    const storageService = new StorageService(
      keyValueStoreService,
      storageConfig,
      defaultConfig,
    );
    await storageService.initialize();
    const adapter = storageService.getAdapter();
    if (!adapter) {
      throw new InternalServerError('Storage service adapter not found');
    }
    return adapter;
  };

  // New document upload route
  router.post(
    '/upload',
    authMiddleware.authenticate,
    metricsMiddleware(container),
    ...FileProcessorFactory.createBufferUploadProcessor({
      fieldName: 'file',
      allowedMimeTypes: Object.values(extensionToMimeType),
      maxFilesAllowed: 1,
      isMultipleFilesAllowed: false,
      processingType: FileProcessingType.BUFFER,
      maxFileSize: 1024 * 1024 * 100,
      strictFileUpload: true,
    }).getMiddleware,
    ValidationMiddleware.validate(UploadNewSchema),
    async (
      req: AuthenticatedUserRequest,
      res: Response,
      next: NextFunction,
    ): Promise<void> => {
      try {
        const adapter = await initializeStorageAdapter(req);
        const storageType = await keyValueStoreService.get<string>(
          storageEtcdPaths.storageType,
        );
        if (!isValidStorageVendor(storageType ?? '')) {
          throw new BadRequestError(`Invalid storage type: ${storageType}`);
        }
        const uploadDocumentService = new UploadDocumentService(
          adapter,
          req.body.fileBuffer as FileBufferInfo,
          getStorageVendor(storageType ?? ''),
          keyValueStoreService,
          defaultConfig,
        );
        return await uploadDocumentService.uploadDocument(req, res, next);
      } catch (error) {
        next(error);
      }
    },
  );

  // Create a document placeholder and then client can upload the
  // document to the placeholder documentPath via direct upload api
  // provided by storage vendors
  router.post(
    '/placeholder',
    authMiddleware.authenticate,
    metricsMiddleware(container),
    ValidationMiddleware.validate(CreateDocumentSchema),
    async (
      req: AuthenticatedUserRequest,
      res: Response,
      next: NextFunction,
    ): Promise<void> => {
      try {
        const {
          documentName,
          alternativeDocumentName,
          documentPath,
          permissions,
          customMetadata,
          isVersionedFile,
        } = req.body as Partial<Document>;

        if (hasExtension(documentName)) {
          throw new BadRequestError(
            'The name of the document cannot have extensions',
          );
        }

        if (documentName?.includes('/')) {
          throw new BadRequestError(
            'The name of the document cannot have forward slash',
          );
        }

        const storageType = await keyValueStoreService.get<string>(
          storageEtcdPaths.storageType,
        );
        const storageVendor = getStorageVendor(storageType ?? '');
        const documentInfo: Partial<Document> = {
          documentName,
          documentPath,
          alternativeDocumentName,
          orgId: new mongoose.Types.ObjectId(`${req.user?.orgId}`),
          isVersionedFile: isVersionedFile,
          permissions: permissions,
          initiatorUserId: req.user?.userId
            ? new mongoose.Types.ObjectId(`${req.user?.userId}`)
            : null,
          customMetadata,
          storageVendor: storageVendor,
        };

        const savedDocument = await DocumentModel.create(documentInfo);
        res.status(200).json(savedDocument);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    '/:documentId',
    authMiddleware.authenticate,
    metricsMiddleware(container),
    ValidationMiddleware.validate(DocumentIdParams),
    async (
      req: AuthenticatedUserRequest,
      res: Response,
      next: NextFunction,
    ): Promise<void> => {
      try {
        const { documentId } = req.params;

        if (!documentId) {
          throw new BadRequestError(' document id is not passed ');
        }

        const doc = await DocumentModel.findOne({
          _id: documentId,
          orgId: req.user?.orgId,
        });

        if (!doc) {
          throw new NotFoundError('Document not found');
        }

        res.status(HTTP_STATUS.OK).json(doc);
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete(
    '/:documentId/',
    authMiddleware.authenticate,
    metricsMiddleware(container),
    ValidationMiddleware.validate(DocumentIdParams),
    async (
      req: AuthenticatedUserRequest,
      res: Response,
      next: NextFunction,
    ): Promise<void> => {
      try {
        const { documentId } = req.params;
        const document = await DocumentModel.findOne({
          _id: documentId,
          orgId: req.user?.orgId,
        });

        if (!document) {
          throw new NotFoundError('Document does not exist');
        }

        document.isDeleted = true;
        document.deletedByUserId = req.user?.userId;
        await document.save();

        res.status(HTTP_STATUS.OK).json(document);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    '/:documentId/download',
    authMiddleware.authenticate,
    metricsMiddleware(container),
    ValidationMiddleware.validate(DocumentIdParamsWithVersion),
    async (
      req: AuthenticatedUserRequest,
      res: Response,
      next: NextFunction,
    ): Promise<void> => {
      try {
        const adapter = await initializeStorageAdapter(req);
        const version = req.query.version;
        const expirationTimeInSeconds = req.query.expirationTimeInSeconds;

        const docResult: DocumentInfoResponse | undefined =
          await getDocumentInfo(req, next); // Use the middleware to get docInfo
        if (!docResult) {
          throw new NotFoundError('Document does not exist');
        }

        const document = docResult.document;
        if (
          version &&
          Number(version) >= (document.versionHistory?.length ?? 0)
        ) {
          throw new BadRequestError("This version doesn't exist");
        }

        if (document.isVersionedFile === false && version !== undefined) {
          throw new BadRequestError('This is a non-versioned document');
        }

        if (
          version &&
          Number(version) >= (document.versionHistory?.length ?? 0)
        ) {
          throw new BadRequestError("This version doesn't exist");
        }
        const storageVendorInETCD = await keyValueStoreService.get<string>(
          storageEtcdPaths.storageType,
        );

        // TODO: fix this usage
        if (document.storageVendor !== storageVendorInETCD) {
          throw new BadRequestError(
            'Storage vendor mismatch, provided storage vendor is not the same as the one used to create the document',
          );
        }

        const signedUrlResult = await adapter.getSignedUrl(
          document,
          version ? Number(version) : undefined,
          undefined, // fileName is not required for download TODO: fix this usage
          expirationTimeInSeconds ? Number(expirationTimeInSeconds) : 3600,
        );

        if (document.storageVendor === StorageVendor.Local) {
          serveFileFromLocalStorage(document, res);
        } else {
          res.status(200).json({ signedUrl: signedUrlResult.data });
        }
      } catch (error) {
        next(error);
      }
    },
  );

  // Document Operations Routes
  router.get(
    '/:documentId/buffer',
    authMiddleware.authenticate,
    metricsMiddleware(container),
    ValidationMiddleware.validate(GetBufferSchema),
    async (
      req: AuthenticatedUserRequest,
      res: Response,
      next: NextFunction,
    ): Promise<void> => {
      try {
        const { version } = req.query;
        const docResult: DocumentInfoResponse | undefined =
          await getDocumentInfo(req, next);
        if (!docResult) {
          throw new NotFoundError('Document does not exist');
        }

        const document = docResult.document;
        const lengthOfVersionHistory = document.versionHistory
          ? document.versionHistory.length
          : 0;

        if (version && Number(version) > lengthOfVersionHistory) {
          throw new BadRequestError("This version doesn't exist");
        }

        const adapter = await initializeStorageAdapter(req);
        const bufferResult = await adapter.getBufferFromStorageService(
          document,
          version ? Number(version) : undefined,
        );

        if (bufferResult.statusCode === HTTP_STATUS.OK) {
          res.status(HTTP_STATUS.OK).json(bufferResult.data);
        } else {
          res.status(HTTP_STATUS.INTERNAL_SERVER).json('Failed to get buffer');
        }
      } catch (error) {
        next(error);
      }
    },
  );

  router.put(
    '/:documentId/buffer',
    authMiddleware.authenticate,
    metricsMiddleware(container),
    ...FileProcessorFactory.createBufferUploadProcessor({
      fieldName: 'file',
      allowedMimeTypes: Object.values(extensionToMimeType),
      maxFilesAllowed: 1,
      isMultipleFilesAllowed: false,
      processingType: FileProcessingType.BUFFER,
      maxFileSize: 1024 * 1024 * 100,
      strictFileUpload: true,
    }).getMiddleware,
    ValidationMiddleware.validate(DocumentIdParams),
    async (
      req: AuthenticatedUserRequest,
      res: Response,
      next: NextFunction,
    ): Promise<void> => {
      try {
        const { buffer, size } = req.body.fileBuffer;

        const docResult: DocumentInfoResponse | undefined =
          await getDocumentInfo(req, next);
        if (!docResult) {
          throw new NotFoundError('Document does not exist');
        }

        const document = docResult.document;

        const adapter = await initializeStorageAdapter(req);
        const uploadResult = await adapter.updateBuffer(buffer, document);

        if (uploadResult.statusCode === 200) {
          document.mutationCount = (document.mutationCount ?? 0) + 1;
          document.sizeInBytes = size;
          await document.save();
          res.status(200).json(uploadResult.data);
        } else {
          logger.error(`Failed to upload buffer: ${uploadResult.msg}`);
          throw new InternalServerError(
            `Failed to upload buffer: ${uploadResult.msg}`,
          );
        }
      } catch (error: any) {
        logger.error(`Failed to upload buffer: ${error.message}`);
        next(error);
      }
    },
  );

  // Version Control Routes
  router.post(
    '/:documentId/uploadNextVersion',
    authMiddleware.authenticate,
    ...FileProcessorFactory.createBufferUploadProcessor({
      fieldName: 'file',
      allowedMimeTypes: Object.values(extensionToMimeType),
      maxFilesAllowed: 1,
      isMultipleFilesAllowed: false,
      processingType: FileProcessingType.BUFFER,
      maxFileSize: 1024 * 1024 * 100,
      strictFileUpload: true,
    }).getMiddleware,
    metricsMiddleware(container),
    ValidationMiddleware.validate(UploadNextVersionSchema),
    async (
      req: AuthenticatedUserRequest,
      res: Response,
      next: NextFunction,
    ): Promise<void> => {
      try {
        const { buffer, originalname, size, mimetype } = req.body.fileBuffer;
        const currentVersionNote = req.body.currentVersionNote; // use this only when current was already modified when upload next version was clicked
        const nextVersionNote = req.body.nextVersionNote; // use this for next version note

        const docResult: DocumentInfoResponse | undefined =
          await getDocumentInfo(req, next); // Use the middleware to get docInfo

        if (!docResult) {
          throw new NotFoundError('Error fetching document from db');
        }

        const document = docResult.document;
        const storageType = document.storageVendor;

        if (document.isVersionedFile === false) {
          throw new BadRequestError('This document cannot be versioned');
        }

        const uploadedFileExtension = path.extname(originalname);

        if (document.extension !== uploadedFileExtension) {
          throw new ForbiddenError(
            'Update buffer failed: File format mismatch',
          );
        }

        await document.save();
        const adapter = await initializeStorageAdapter(req);
        const isDocumentChanged = !(await compareDocuments(
          document,
          undefined,
          document.versionHistory?.length
            ? document.versionHistory.length - 1
            : 0,
          adapter,
        ));

        if (isDocumentChanged === true) {
          const nextVersion = document.versionHistory?.length ?? 0;
          const newDocumentFilePath = `${document.documentPath}/versions/v${nextVersion}${document.extension}`;
          const bufferResponse = await adapter.getBufferFromStorageService(
            document,
            undefined, //passing version as undefined to get the buffer of current
          );

          if (bufferResponse.statusCode !== 200) {
            throw new InternalServerError(
              `Some error occurred while uploading next version: ${bufferResponse.msg}`,
            );
          }

          const response = await cloneDocument(
            document,
            bufferResponse.data as Buffer,
            newDocumentFilePath,
            next,
            adapter,
          );

          if (!response) {
            throw new InternalServerError('Failed to upload document');
          }

          if (response.statusCode !== 200) {
            throw new InternalServerError(
              response.data ??
                'Some error occurred while uploading next version',
            );
          }
          const storageType = await keyValueStoreService.get<string>(
            storageEtcdPaths.storageType,
          );
          if (!isValidStorageVendor(storageType ?? '')) {
            throw new BadRequestError(`Invalid storage type: ${storageType}`);
          }

          document.versionHistory?.push({
            version: nextVersion,
            [`${storageType}`]: {
              url: response?.data,
            },
            mutationCount: document.mutationCount,
            size: document.sizeInBytes,
            extension: document.extension,
            note: currentVersionNote,
            initiatedByUserId: req.user?.userId,
            createdAt: Date.now(),
          });

          await document.save();
        }

        const nextVersion = document.versionHistory?.length ?? 0;
        const newDocumentFilePath = `${document.documentPath}/versions/v${nextVersion}${document.extension}`;

        const nextVersionPayload: FilePayload = {
          buffer: buffer,
          mimeType: mimetype,
          documentPath: newDocumentFilePath,
          isVersioned: document.isVersionedFile,
        };

        const response = await adapter.uploadDocumentToStorageService(
          nextVersionPayload as FilePayload,
        );

        if (response.statusCode !== 200) {
          throw new InternalServerError(
            `some error occurred while uploading, try after sometime: ${response.msg}`,
          );
        }

        const currentFileResponse = await cloneDocument(
          document,
          buffer,
          `${document.documentPath}/current/${document.documentName}${document.extension}`,
          next,
          adapter,
        );

        if (currentFileResponse && currentFileResponse.statusCode !== 200) {
          throw new InternalServerError(
            currentFileResponse.data ??
              'Some error occurred while uploading next version',
          );
        }

        const fileExtension = path.extname(originalname);

        document.mutationCount = (document.mutationCount ?? 0) + 1;

        document.versionHistory?.push({
          version: nextVersion,
          [`${storageType}`]: {
            url: response?.data,
          },
          size: size,
          mutationCount: document.mutationCount,
          extension: fileExtension,
          note: nextVersionNote,
          initiatedByUserId: req.user?.userId,
          createdAt: Date.now(),
        });

        document.sizeInBytes = size;

        await document.save();

        res.status(HTTP_STATUS.OK).json(document);
      } catch (error) {
        next(error);
      }
    },
  );

  // Rollback to previous version
  router.post(
    '/:documentId/rollBack',
    authMiddleware.authenticate,
    metricsMiddleware(container),
    ValidationMiddleware.validate(RollBackToPreviousVersionSchema),
    async (
      req: AuthenticatedUserRequest,
      res: Response,
      next: NextFunction,
    ): Promise<void> => {
      try {
        const { version, note } = req.body as { version: string; note: string };

        const docResult: DocumentInfoResponse | undefined =
          await getDocumentInfo(req, next);
        if (!docResult) {
          throw new NotFoundError('Document Id does not exist');
        }

        const document = docResult.document;

        if (document.isVersionedFile) {
          throw new BadRequestError(
            'This is a non-versioned document, no previous exists',
          );
        }

        await document.save();

        const currentVersion = document.versionHistory
          ? document.versionHistory.length
          : 0;
        if (Number(version) >= currentVersion - 1) {
          throw new BadRequestError(
            `Rollback version greater than current: ${currentVersion - 1}`,
          );
        }
        const adapter = await initializeStorageAdapter(req);
        const bufferResult = await adapter.getBufferFromStorageService(
          document,
          Number(version),
        );

        if (bufferResult.statusCode !== HTTP_STATUS.OK) {
          throw new InternalServerError(
            `Some error occurred while rollback: ${bufferResult.msg}`,
          );
        }

        const currentFileResponse = await cloneDocument(
          document,
          bufferResult.data as Buffer,
          `${document.documentPath}/current/${document.documentName}${document.extension}`,
          next,
          adapter,
        );

        if (!currentFileResponse) {
          throw new InternalServerError(
            'Some error occurred while cloning document',
          );
        }

        const nextVersion = document.versionHistory
          ? document.versionHistory.length
          : 0;
        const newDocumentFilePath = `${document.documentPath}/versions/v${nextVersion}${document.extension}`;
        const response = await cloneDocument(
          document,
          bufferResult.data as Buffer,
          newDocumentFilePath,
          next,
          adapter,
        );

        if (!response) {
          throw new InternalServerError(
            'Some error occurred while cloning document',
          );
        }

        const storageType = await keyValueStoreService.get<string>(
          storageEtcdPaths.storageType,
        );
        if (!isValidStorageVendor(storageType ?? '')) {
          throw new BadRequestError(`Invalid storage type: ${storageType}`);
        }
        document.mutationCount = (document.mutationCount ?? 0) + 1;
        document.versionHistory = document.versionHistory ?? [];
        document.versionHistory.push({
          version: nextVersion,
          [`${storageType}`]: {
            url: response?.data,
          },
          mutationCount: document.mutationCount,
          extension: document.extension,
          note: note,
          size: document.versionHistory[Number(version)]?.size,
          initiatedByUserId: req.user?.userId,
          createdAt: Date.now(),
        });

        document.sizeInBytes = document.versionHistory[Number(version)]?.size;

        await document.save();

        res.status(HTTP_STATUS.OK).json(document);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    '/:documentId/directUpload',
    authMiddleware.authenticate,
    metricsMiddleware(container),
    ValidationMiddleware.validate(DirectUploadSchema),
    async (
      req: AuthenticatedUserRequest,
      res: Response,
      next: NextFunction,
    ): Promise<void> => {
      try {
        const { documentId } = req.params;

        const document = await DocumentModel.findOne({
          _id: documentId,
          orgId: req.user?.orgId,
        });

        if (!document || !document.documentPath) {
          throw new NotFoundError('Document / Document Path does not exist');
        }
        const adapter = await initializeStorageAdapter(req);
        const presignedUrlResponse =
          await adapter.generatePresignedUrlForDirectUpload(
            document.documentPath,
          );

        if (presignedUrlResponse.statusCode !== 200) {
          logger.error(
            'Error generating presigned URL for part:',
            presignedUrlResponse.data?.url,
          );
          const errorMetadata: ErrorMetadata = {
            statusCode: presignedUrlResponse.statusCode,
            requestedUrl: presignedUrlResponse.data?.url,
            errorMessage: presignedUrlResponse.msg,
            timestamp: new Date().toISOString(),
          };
          throw new InternalServerError(
            'Error generating presigned URL for part:',
            errorMetadata,
          );
        }

        const url = presignedUrlResponse.data?.url;
        if (!url) {
          throw new InternalServerError('Failed to generate presigned URL');
        }

        const storageVendor = document.storageVendor;
        if (!isValidStorageVendor(storageVendor ?? '')) {
          throw new BadRequestError(`Invalid storage type: ${storageVendor}`);
        }

        if (storageVendor === StorageVendor.S3) {
          document.s3 = {
            url: getBaseUrl(url) as string,
          };
        } else if (storageVendor === StorageVendor.AzureBlob) {
          document.azureBlob = {
            url: getBaseUrl(url) as string,
          };
        }

        await document.save();
        res.status(HTTP_STATUS.OK).json({
          signedUrl: presignedUrlResponse.data?.url,
          documentId: document._id,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    '/:documentId/isModified',
    authMiddleware.authenticate,
    metricsMiddleware(container),
    ValidationMiddleware.validate(DocumentIdParams),
    async (
      req: AuthenticatedUserRequest,
      res: Response,
      next: NextFunction,
    ): Promise<void> => {
      try {
        const docResult: DocumentInfoResponse | undefined =
          await getDocumentInfo(req, next);
        if (!docResult) {
          throw new NotFoundError('Document does not exist');
        }

        const document = docResult.document;
        const adapter = await initializeStorageAdapter(req);
        const isDocumentChanged = !(await compareDocuments(
          document,
          undefined,
          document.versionHistory?.length
            ? document.versionHistory.length - 1
            : 0,
          adapter,
        ));

        if (isDocumentChanged === true) {
          res.status(HTTP_STATUS.OK).json(true);
        } else if (isDocumentChanged === false) {
          res.status(HTTP_STATUS.OK).json(false);
        } else {
          throw new InternalServerError(
            'Some error occurred while comparing documents',
          );
        }
      } catch (error) {
        next(error);
      }
    },
  );

  const cloneDocument = async (
    document: mongoose.Document<unknown, {}, DocumentModel> & DocumentModel,
    buffer: Buffer,
    newDocumentFilePath: string,
    next: NextFunction,
    adapter: StorageServiceAdapter,
  ): Promise<StorageServiceResponse<string> | undefined> => {
    try {
      const mimetype = getMimeType(document.extension);
      const cloneFilePayload: FilePayload = {
        buffer: buffer,
        mimeType: mimetype,
        documentPath: newDocumentFilePath,
        isVersioned: document.isVersionedFile,
      };
      return await adapter.uploadDocumentToStorageService(cloneFilePayload);
    } catch (error) {
      next(error);
      return undefined;
    }
  };

  const compareDocuments = async (
    document: DocumentModel,
    version1: number | undefined,
    version2: number | undefined,
    adapter: StorageServiceAdapter,
  ): Promise<boolean> => {
    if (!document) {
      return false;
    }
    const response1 = await adapter.getBufferFromStorageService(
      document,
      version1,
    );
    const response2 = await adapter.getBufferFromStorageService(
      document,
      version2,
    );
    return (
      (response1.data as Buffer)?.equals(response2.data as Buffer) ?? false
    );
  };

  return router;
}
