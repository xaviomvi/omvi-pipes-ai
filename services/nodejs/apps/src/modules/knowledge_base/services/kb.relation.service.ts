import { inject, injectable } from 'inversify';
import { v4 as uuidv4 } from 'uuid';
import { ArangoService } from '../../../libs/services/arango.service';
import {
  DocumentCollection,
  EdgeCollection,
  SchemaOptions,
} from 'arangojs/collections';
import { Database } from 'arangojs';
import { aql } from 'arangojs/aql';
import { Logger } from '../../../libs/services/logger.service';
import { recordSchema } from '../schemas/record';
import { EdgeDefinition } from 'arangojs/graphs';
import { fileRecordSchema } from '../schemas/file_record';
import { recordToRecordEdgeSchema } from '../schemas/edges/record_record.edge';
import {
  COLLECTION_TYPE,
  COLLECTIONS,
  GRAPHS,
  RELATIONSHIP_TYPE,
} from '../constants/record.constants';
import { UserSchema } from '../schemas/user';
import { recordToFileRecordEdgeSchema } from '../schemas/edges/record_fileRecord.edge';
import { kbToRecordEdgeSchema } from '../schemas/edges/kb_record.edge';
import { kbToUserPermissionEdgeSchema } from '../schemas/edges/kb_user_permission.edge';
import { kbSchema } from '../schemas/kb';
import { IRecordDocument } from '../types/record';
import { IFileRecordDocument } from '../types/file_record';
import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
} from '../../../libs/errors/http.errors';
import {
  DeletedRecordEvent,
  Event,
  EventType,
  NewRecordEvent,
  RecordsEventProducer,
  UpdateRecordEvent,
} from './records_events.service';
import { KeyValueStoreService } from '../../../libs/services/keyValueStore.service';
import { storageEtcdPaths } from '../../storage/constants/constants';

const logger = Logger.getInstance({
  service: 'Knowledge Base Service',
});

@injectable()
export class RecordRelationService {
  private db: Database;
  private recordCollection: DocumentCollection;
  private fileRecordCollection: DocumentCollection;
  private userCollection: DocumentCollection;
  private kbCollection: DocumentCollection;
  private recordToRecordEdges: EdgeCollection;
  private isOfTypeEdges: EdgeCollection;
  private permissionEdges: EdgeCollection;
  private kbToRecordEdges: EdgeCollection;

  constructor(
    @inject(ArangoService) private readonly arangoService: ArangoService,
    @inject(RecordsEventProducer)
    private readonly eventProducer: RecordsEventProducer,
  ) {
    this.db = this.arangoService.getConnection();

    // Document collections
    this.recordCollection = this.db.collection(COLLECTIONS.RECORD);
    this.fileRecordCollection = this.db.collection(COLLECTIONS.FILE_RECORD);
    this.userCollection = this.db.collection(COLLECTIONS.USER);
    this.kbCollection = this.db.collection(COLLECTIONS.KNOWLEDGEBASE);

    // Edge collections
    this.recordToRecordEdges = this.db.collection(
      COLLECTIONS.RECORD_TO_RECORD,
    ) as EdgeCollection;
    this.isOfTypeEdges = this.db.collection(
      COLLECTIONS.IS_OF_TYPE,
    ) as EdgeCollection;
    this.permissionEdges = this.db.collection(
      COLLECTIONS.PERMISSION,
    ) as EdgeCollection;
    this.kbToRecordEdges = this.db.collection(
      COLLECTIONS.BELONGS_TO,
    ) as EdgeCollection;

    this.initializeCollections();
    this.initializeEventProducer();
  }

  private async initializeCollections() {
    try {
      // Create document collections if they don't exist
      await this.ensureCollection(this.recordCollection, recordSchema);
      await this.ensureCollection(this.fileRecordCollection, fileRecordSchema);
      await this.ensureCollection(this.userCollection, UserSchema);
      await this.ensureCollection(this.kbCollection, kbSchema);

      // Create edge collections if they don't exist
      await this.ensureEdgeCollection(
        this.recordToRecordEdges,
        recordToRecordEdgeSchema,
      );
      await this.ensureEdgeCollection(
        this.isOfTypeEdges,
        recordToFileRecordEdgeSchema,
      );
      await this.ensureEdgeCollection(
        this.permissionEdges,
        kbToUserPermissionEdgeSchema,
      );
      await this.ensureEdgeCollection(
        this.kbToRecordEdges,
        kbToRecordEdgeSchema,
      );

      // Create the knowledge base graph structure
      const kbGraphName = GRAPHS.KB_GRAPH;

      const kbEdgeDefinitions: EdgeDefinition[] = [
        {
          collection: COLLECTIONS.PERMISSION,
          from: [COLLECTIONS.USER],
          to: [COLLECTIONS.KNOWLEDGEBASE],
        },
        {
          collection: COLLECTIONS.BELONGS_TO,
          from: [COLLECTIONS.RECORD],
          to: [COLLECTIONS.KNOWLEDGEBASE],
        },
        {
          collection: COLLECTIONS.RECORD_TO_RECORD,
          from: [COLLECTIONS.RECORD],
          to: [COLLECTIONS.RECORD],
        },
        {
          collection: COLLECTIONS.IS_OF_TYPE,
          from: [COLLECTIONS.RECORD],
          to: [COLLECTIONS.FILE_RECORD],
        },
      ];

      // Check if the knowledge base graph exists, if not create it
      const kbGraphExists = await this.db
        .listGraphs()
        .then((graphs) => graphs.some((g) => g.name === kbGraphName));

      if (!kbGraphExists) {
        await this.db.createGraph(kbGraphName, kbEdgeDefinitions);
        logger.info(`Created knowledge base graph: ${kbGraphName}`);
      }

      logger.info(
        'Successfully initialized knowledge base collections and graphs',
      );
    } catch (error) {
      logger.error('Failed to initialize collections', error);
      throw new InternalServerError(
        error instanceof Error ? error.message : 'Unexpected error occurred',
      );
    }
  }
  private async initializeEventProducer() {
    try {
      await this.eventProducer.start();
      logger.info('Event producer initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize event producer', error);
      throw new InternalServerError(
        error instanceof Error
          ? error.message
          : 'Failed to initialize event producer',
      );
    }
  }

  private async ensureCollection(
    collection: DocumentCollection,
    schema: SchemaOptions,
  ): Promise<void> {
    try {
      const exists = await collection.exists();
      if (!exists) {
        await collection.create({ schema });
        logger.info(`Created collection: ${collection.name}`);
      } else {
        // Optionally update schema if needed
        await collection.properties({ schema });
        logger.info(`Updated schema for collection: ${collection.name}`);
      }
    } catch (error) {
      logger.error(
        `Error creating/updating collection ${collection.name}`,
        error,
      );
      throw new InternalServerError(
        error instanceof Error ? error.message : 'Unexpected error occurred',
      );
    }
  }

  private async ensureEdgeCollection(
    collection: EdgeCollection,
    schema: SchemaOptions,
  ): Promise<void> {
    try {
      const exists = await collection.exists();
      if (!exists) {
        // Create it properly as an edge collection
        await this.db.createCollection(collection.name, {
          type: COLLECTION_TYPE.EDGE,
          schema,
        });
        logger.info(`Created edge collection: ${collection.name}`);
      } else {
        // Check if it's actually an edge collection
        const info = await collection.properties();
        if (info.type !== COLLECTION_TYPE.EDGE) {
          // Can't convert, must drop and recreate
          logger.warn(
            `Collection ${collection.name} exists but is not an edge collection. Will drop and recreate.`,
          );
          await collection.drop();
          await this.db.createCollection(collection.name, {
            type: COLLECTION_TYPE.EDGE,
            schema,
          });
          logger.info(`Recreated ${collection.name} as an edge collection`);
        } else {
          // Just update the schema
          await collection.properties({ schema });
          logger.info(`Updated schema for edge collection: ${collection.name}`);
        }
      }
    } catch (error) {
      logger.error(
        `Error creating/updating edge collection ${collection.name}`,
        error,
      );
      throw new InternalServerError(
        error instanceof Error ? error.message : 'Unexpected error occurred',
      );
    }
  }

  /**
   * Publishes events for multiple records and their associated file records
   * @param records The inserted records
   * @param fileRecords The associated file records
   */
  private async publishRecordEvents(
    records: IRecordDocument[],
    fileRecords: IFileRecordDocument[],
    keyValueStoreService: KeyValueStoreService,
  ): Promise<void> {
    try {
      // Create a batch of promises for event publishing
      const publishPromises = records.map(async (record, index) => {
        try {
          // Create the payload using the separate function
          const newRecordPayload = await this.createNewRecordEventPayload(
            record,
            keyValueStoreService,
            fileRecords[index],
          );

          const event: Event = {
            eventType: EventType.NewRecordEvent,
            timestamp: Date.now(),
            payload: newRecordPayload,
          };

          // Return the promise for event publishing
          return this.eventProducer.publishEvent(event);
        } catch (error) {
          logger.error(
            `Failed to create event payload for record ${record._key}`,
            { error },
          );
          // Return a resolved promise to avoid failing the Promise.all
          return Promise.resolve();
        }
      });

      // Execute all publish operations concurrently
      await Promise.all(publishPromises);
      logger.info(`Published events for ${records.length} records`);
    } catch (error) {
      // Log but don't throw the error to avoid affecting the main operation
      logger.error('Error publishing batch record events', { error });
    }
  }

  /**
   * Creates a standardized new record event payload considering both record and file record information
   * @param record The record document
   * @param fileRecord Optional associated file record for additional metadata
   * @returns NewRecordEvent payload for Kafka
   */
  private async createNewRecordEventPayload(
    record: IRecordDocument,
    keyValueStoreService: KeyValueStoreService,
    fileRecord?: IFileRecordDocument,
  ): Promise<NewRecordEvent> {
    // Generate signed URL route based on record information
    const storageUrl =
      (await keyValueStoreService.get(storageEtcdPaths.endpoint)) ||
      'http://localhost:3000';
    const signedUrlRoute = `${storageUrl}/api/v1/document/${record.externalRecordId}/download`;

    // Determine the appropriate extension by prioritizing different sources
    let extension = '';
    if (fileRecord && fileRecord.extension) {
      extension = fileRecord.extension;
    }

    return {
      orgId: record.orgId,
      recordId: record._key,
      recordName: record.recordName,
      recordType: record.recordType,
      version: record.version || 1,
      signedUrlRoute: signedUrlRoute,
      origin: record.origin,
      extension: extension,
      createdAtTimestamp: (record.createdAtTimestamp || Date.now()).toString(),
      updatedAtTimestamp: (record.updatedAtTimestamp || Date.now()).toString(),
      sourceCreatedAtTimestamp: (
        record.sourceCreatedAtTimestamp ||
        record.createdAtTimestamp ||
        Date.now()
      ).toString(),
    };
  }

  /**
   * Creates a standardized update record event payload
   * @param record The updated record
   * @returns UpdateRecordEvent payload for Kafka
   */
  private async createUpdateRecordEventPayload(
    record: IRecordDocument,
    keyValueStoreService: KeyValueStoreService,
  ): Promise<UpdateRecordEvent> {
    // Generate signed URL route based on record information
    const storageUrl =
      (await keyValueStoreService.get(storageEtcdPaths.endpoint)) ||
      'http://localhost:3000';
    const signedUrlRoute = `${storageUrl}/api/v1/document/${record.externalRecordId}/download`;

    return {
      orgId: record.orgId,
      recordId: record._key,
      version: record.version || 1,
      signedUrlRoute: signedUrlRoute,
      updatedAtTimestamp: (record.updatedAtTimestamp || Date.now()).toString(),
      sourceLastModifiedTimestamp: (
        record.sourceLastModifiedTimestamp ||
        record.updatedAtTimestamp ||
        Date.now()
      ).toString(),
    };
  }

  /**
   * Creates a standardized delete record event payload
   * @param record The record being deleted
   * @param userId The user performing the deletion
   * @returns DeletedRecordEvent payload for Kafka
   */
  private createDeletedRecordEventPayload(
    record: IRecordDocument,
  ): DeletedRecordEvent {
    return {
      orgId: record.orgId,
      recordId: record._key,
      version: record.version || 1,
    };
  }

  /**
   * Get or create a knowledge base for a specific organization
   * @param orgId The organization ID
   * @param name Optional name for the knowledge base
   * @returns The knowledge base document
   */
  async getOrCreateKnowledgeBase(
    orgId: string,
    name: string = 'Default',
  ): Promise<any> {
    try {
      if (!orgId) {
        throw new NotFoundError(
          'Organization ID is required to get or create a knowledge base',
        );
      }

      // Check if a knowledge base already exists for this organization
      const cursor = await this.db.query(aql`
        FOR kb IN ${this.kbCollection}
          FILTER kb.orgId == ${orgId} AND kb.isDeleted == false
          RETURN kb
      `);

      const existingKBs = await cursor.all();

      if (existingKBs.length > 0) {
        logger.info(`Found existing knowledge base for organization ${orgId}`);
        return existingKBs[0];
      }

      // Create a new knowledge base
      const currentTime = Date.now();
      const kb = {
        orgId,
        name,
        createdAt: currentTime,
        updatedAt: currentTime,
        isDeleted: false,
        isArchived: false,
      };

      const result = await this.kbCollection.save(kb);
      logger.info(`Created new knowledge base for organization ${orgId}`);

      return {
        ...kb,
        _id: result._id,
        _key: result._key,
        _rev: result._rev,
      };
    } catch (error) {
      logger.error('Failed to get or create knowledge base', {
        orgId,
        error,
      });
      throw new InternalServerError(
        error instanceof Error ? error.message : 'Unexpected error occurred',
      );
    }
  }

  /**
   * Inserts a record document into the record collection
   * @param record The record document to insert
   * @returns The inserted record document
   */
  async insertRecord(record: IRecordDocument): Promise<IRecordDocument> {
    try {
      const result = await this.recordCollection.save(record, {
        returnNew: true,
      });
      logger.info(`Inserted record with ID ${result._key}`);
      return result.new as IRecordDocument;
    } catch (error) {
      logger.error('Failed to insert record', { record, error });
      throw new InternalServerError(
        error instanceof Error ? error.message : 'Unexpected error occurred',
      );
    }
  }

  /**
   * Inserts a file record document into the file record collection
   * @param fileRecord The file record document to insert
   * @returns The inserted file record document
   */
  async insertFileRecord(
    fileRecord: IFileRecordDocument,
  ): Promise<IFileRecordDocument> {
    try {
      const result = await this.fileRecordCollection.save(fileRecord, {
        returnNew: true,
      });
      logger.info(`Inserted file record with ID ${result._key}`);
      return result.new as IFileRecordDocument;
    } catch (error) {
      logger.error('Failed to insert file record', { fileRecord, error });
      throw new InternalServerError(
        error instanceof Error ? error.message : 'Unexpected error occurred',
      );
    }
  }

  /**
   * Inserts multiple records and their associated file records in a transaction
   * @param records Array of record documents
   * @param fileRecords Array of file record documents
   * @returns Object containing arrays of inserted records and file records
   */
  async insertRecordsAndFileRecords(
    records: IRecordDocument[],
    fileRecords: IFileRecordDocument[],
    keyValueStoreService: KeyValueStoreService,
  ): Promise<{
    insertedRecords: IRecordDocument[];
    insertedFileRecords: IFileRecordDocument[];
  }> {
    if (records.length !== fileRecords.length) {
      throw new BadRequestError(
        'Records and file records arrays must be of the same length',
      );
    }

    const trx = await this.db.beginTransaction({
      write: [COLLECTIONS.RECORD, COLLECTIONS.FILE_RECORD],
    });

    try {
      // Insert records
      const insertedRecords: IRecordDocument[] = [];
      for (const record of records) {
        const recordResult = await trx.step(() =>
          this.recordCollection.save(record, { returnNew: true }),
        );
        insertedRecords.push(recordResult.new as IRecordDocument);
      }

      // Insert file records
      const insertedFileRecords: IFileRecordDocument[] = [];
      for (let i = 0; i < fileRecords.length; i++) {
        const fileRecord: IFileRecordDocument = {
          ...fileRecords[i],
          _key: insertedRecords[i]?._key,
        } as IFileRecordDocument;
        const fileRecordResult = await trx.step(() =>
          this.fileRecordCollection.save(fileRecord, { returnNew: true }),
        );
        insertedFileRecords.push(fileRecordResult.new as IFileRecordDocument);
      }

      // Commit the transaction
      await trx.commit();

      logger.info(
        `Successfully inserted ${insertedRecords.length} records and file records`,
      );

      await this.publishRecordEvents(
        insertedRecords,
        insertedFileRecords,
        keyValueStoreService,
      );

      return { insertedRecords, insertedFileRecords };
    } catch (error) {
      // Try to abort the transaction
      try {
        await trx.abort();
      } catch (abortError: any) {
        if (!abortError.message?.includes('already committed')) {
          logger.error('Error aborting transaction', { error: abortError });
        }
      }

      logger.error('Failed to insert records and file records', { error });
      throw new InternalServerError(
        error instanceof Error ? error.message : 'Unexpected error occurred',
      );
    }
  }

  /**
   * Creates a relationship between two records
   */
  async createRecordRelationship(
    fromRecordId: string,
    toRecordId: string,
    relationshipType: string,
  ): Promise<string> {
    try {
      const fromHandle = `${COLLECTIONS.RECORD}/${fromRecordId}`;
      const toHandle = `${COLLECTIONS.RECORD}/${toRecordId}`;

      // Check if relationship already exists
      const cursor = await this.db.query(aql`
        FOR edge IN ${this.recordToRecordEdges}
          FILTER edge._from == ${fromHandle} AND edge._to == ${toHandle}
          RETURN edge
      `);

      const existing = await cursor.all();

      if (existing.length > 0) {
        // Relationship already exists
        logger.info(
          `Relationship between records ${fromRecordId} and ${toRecordId} already exists`,
        );
        return existing[0]._key;
      }

      // Create the edge
      const edge = {
        _from: fromHandle,
        _to: toHandle,
        relationshipType,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = await this.recordToRecordEdges.save(edge);
      logger.info(
        `Created relationship between records ${fromRecordId} and ${toRecordId}`,
      );

      return result._key;
    } catch (error) {
      logger.error('Failed to create record relationship', {
        fromRecordId,
        toRecordId,
        relationshipType,
        error,
      });
      throw new InternalServerError(
        error instanceof Error ? error.message : 'Unexpected error occurred',
      );
    }
  }

  /**
   * Creates a relationship between a record and its file record using the is_of_type edge
   */
  async createRecordToFileRecordRelationship(
    recordId: string,
    fileRecordId: string,
  ): Promise<string> {
    try {
      const recordHandle = `${COLLECTIONS.RECORD}/${recordId}`;
      const fileRecordHandle = `${COLLECTIONS.FILE_RECORD}/${fileRecordId}`;

      // Check if relationship already exists
      const cursor = await this.db.query(aql`
          FOR edge IN ${this.isOfTypeEdges}
            FILTER edge._from == ${recordHandle} AND edge._to == ${fileRecordHandle}
            RETURN edge
        `);

      const existing = await cursor.all();

      if (existing.length > 0) {
        // Relationship already exists
        logger.info(
          `Relationship between record ${recordId} and file record ${fileRecordId} already exists`,
        );
        return existing[0]._key;
      }

      const currentTime = Date.now();

      // Create the edge
      const edge = {
        _from: recordHandle,
        _to: fileRecordHandle,
        createdAt: currentTime,
        updatedAt: currentTime,
        isDeleted: false,
      };

      const result = await this.isOfTypeEdges.save(edge);
      logger.info(
        `Created is_of_type relationship between record ${recordId} and file record ${fileRecordId}`,
      );

      return result._key;
    } catch (error) {
      logger.error('Failed to create record-to-file-record relationship', {
        recordId,
        fileRecordId,
        error,
      });
      throw new InternalServerError(
        error instanceof Error ? error.message : 'Unexpected error occurred',
      );
    }
  }

  /**
   * Add a record to a knowledge base with a belongs_to relationship
   */
  async addRecordToKnowledgeBase(
    kbId: string,
    recordId: string,
  ): Promise<string> {
    try {
      const kbHandle = `${COLLECTIONS.KNOWLEDGEBASE}/${kbId}`;
      const recordHandle = `${COLLECTIONS.RECORD}/${recordId}`;

      // Check if relationship already exists
      const cursor = await this.db.query(aql`
        FOR edge IN ${this.kbToRecordEdges}
          FILTER edge._from == ${recordHandle} AND edge._to == ${kbHandle}
          RETURN edge
      `);

      const existing = await cursor.all();

      if (existing.length > 0) {
        // Relationship already exists
        logger.info(
          `Record ${recordId} is already part of knowledge base ${kbId}`,
        );
        return existing[0]._key;
      }

      const currentTime = Date.now();

      // Create the edge
      const edge = {
        _from: recordHandle,
        _to: kbHandle,
        createdAt: currentTime,
        updatedAt: currentTime,
        isDeleted: false,
      };

      const result = await this.kbToRecordEdges.save(edge);
      logger.info(`Added record ${recordId} to knowledge base ${kbId}`);

      return result._key;
    } catch (error) {
      logger.error('Failed to add record to knowledge base', {
        kbId,
        recordId,
        error,
      });
      throw new InternalServerError(
        error instanceof Error ? error.message : 'Unexpected error occurred',
      );
    }
  }

  /**
   * Create a permission relationship between a knowledge base and a user
   */
  async createKbUserPermission(
    kbId: string,
    userId: string,
    role: string = RELATIONSHIP_TYPE.USER,
    permissionTypes: string[] = ['OWNER'],
  ): Promise<string> {
    try {
      const kbHandle = `${COLLECTIONS.KNOWLEDGEBASE}/${kbId}`;
      const userHandle = `${COLLECTIONS.USER}/${userId}`;

      // Check if permission already exists
      const cursor = await this.db.query(aql`
        FOR edge IN ${this.permissionEdges}
          FILTER edge._from == ${userHandle} AND edge._to == ${kbHandle}
          RETURN edge
      `);

      const existing = await cursor.all();

      if (existing.length > 0) {
        // Permission already exists
        logger.info(
          `User ${userId} already has permissions for knowledge base ${kbId}`,
        );
        return existing[0]._key;
      }

      const currentTime = Date.now();

      // Create the edge
      const edge = {
        _from: userHandle,
        _to: kbHandle,
        role,
        type: permissionTypes,
        createdAt: currentTime,
        last_updated: currentTime,
        isDeleted: false,
      };

      const result = await this.permissionEdges.save(edge);
      logger.info(
        `Created ${role} permission for user ${userId} on knowledge base ${kbId}`,
      );

      return result._key;
    } catch (error) {
      logger.error('Failed to create knowledge base permission', {
        kbId,
        userId,
        role,
        error,
      });
      throw new InternalServerError(
        error instanceof Error ? error.message : 'Unexpected error occurred',
      );
    }
  }

  /**
   * Finds or creates a user in the user collection based on userId and orgId
   * @param userId External user ID reference
   * @param email User's email
   * @param orgId Organization ID
   * @param firstName User's first name
   * @param lastName User's last name
   * @param designation User's designation/title
   * @returns The found or created user document
   */
  async findOrCreateUser(
    userId: string,
    email: string,
    orgId: string,
    firstName?: string,
    lastName?: string,
    designation?: string,
  ): Promise<any> {
    try {
      // Validate required parameters
      if (!userId) {
        throw new NotFoundError('UserId is required to find or create a user');
      }

      if (!orgId) {
        throw new NotFoundError(
          'Organization ID is required to find or create a user',
        );
      }

      if (!email) {
        logger.warn('Email is missing for user creation', { userId, orgId });
        // Use a default email if none provided
        throw new NotFoundError('Email is required');
      }

      // First, try to find the user by both userId and orgId
      const userByIdCursor = await this.db.query(aql`
      FOR user IN ${this.userCollection}
        FILTER user.userId == ${userId} AND user.orgId == ${orgId} AND user.isDeleted == false
        RETURN user
    `);

      const usersById = await userByIdCursor.all();

      if (usersById.length > 0) {
        logger.info(`User with userId ${userId} and orgId ${orgId} found`);
        return usersById[0];
      }

      // Next, try to find by email and orgId if it's not the default placeholder
      if (email && email !== `user-${userId}@example.com`) {
        const emailCursor = await this.db.query(aql`
      FOR user IN ${this.userCollection}
        FILTER user.email == ${email} AND user.orgId == ${orgId} AND user.isDeleted == false
        RETURN user
      `);

        const usersByEmail = await emailCursor.all();

        if (usersByEmail.length > 0) {
          logger.info(
            `User with email ${email} for organization ${orgId} already exists`,
          );

          // If found by email but userId doesn't match, update the userId
          if (usersByEmail[0].userId !== userId) {
            await this.userCollection.update(usersByEmail[0]._key, {
              userId: userId,
              updatedAtTimestamp: Date.now(),
            });

            logger.info(`Updated existing user with new userId ${userId}`);

            // Fetch the updated user
            return await this.userCollection.document(usersByEmail[0]._key);
          }

          return usersByEmail[0];
        }
      }

      // No existing user found, create a new one
      const currentTime = Date.now();
      const fullName =
        firstName && lastName
          ? `${firstName} ${lastName}`
          : firstName || email.split('@')[0];

      // Generate a unique key for the document
      const key = uuidv4();

      // Prepare user document
      const user = {
        _key: key,
        userId: userId, // Store the external userId as a regular field
        orgId: orgId, // Ensure orgId is stored in the document
        email,
        firstName: firstName || '',
        lastName: lastName || '',
        fullName,
        designation: designation || '',
        isActive: true,
        isDeleted: false,
        createdAtTimestamp: currentTime,
        updatedAtTimestamp: currentTime,
      };

      // Log before saving to help with debugging
      logger.debug('Creating new user', { user });

      try {
        const result = await this.userCollection.save(user);
        logger.info(`User created successfully`, { key, userId, orgId, email });

        // Return the created user
        return {
          ...user,
          _id: result._id,
          _rev: result._rev,
        };
      } catch (saveError) {
        logger.error('Failed to save user to database', {
          error: saveError,
          userId,
          orgId,
          email,
        });
        throw new InternalServerError(
          saveError instanceof Error
            ? saveError.message
            : 'Unexpected error occurred',
        );
      }
    } catch (error) {
      logger.error('Error in findOrCreateUser', {
        userId,
        orgId,
        email,
        error,
      });
      throw new InternalServerError(
        error instanceof Error ? error.message : 'Unexpected error occurred',
      );
    }
  }

  /**
   * Gets a record by ID, including its file record and relationships
   * @param recordId The record ID to retrieve
   * @param userId The user ID requesting the record
   * @param orgId The organization ID for the user
   * @returns The record with related data and permission information
   */
  async getRecordById(
    recordId: string,
    userId: string,
    orgId: string,
  ): Promise<any> {
    try {
      logger.debug('Getting record by ID', { recordId, userId, orgId });

      // Find the user by userId and orgId fields
      let user;
      try {
        const userCursor = await this.db.query(aql`
        FOR user IN ${this.userCollection}
          FILTER user.userId == ${userId} AND user.orgId == ${orgId} AND user.isDeleted != true
          RETURN user
      `);

        const users = await userCursor.all();

        if (users.length === 0) {
          throw new Error(
            `User with ID ${userId} in organization ${orgId} not found`,
          );
        }

        user = users[0];
      } catch (error) {
        logger.error('User not found', { userId, orgId, error });
        throw new UnauthorizedError(
          `User with ID ${userId} in organization ${orgId} not found`,
        );
      }

      // Find the knowledge bases that the user has access to
      const userKbCursor = await this.db.query(aql`
      FOR edge IN ${this.permissionEdges}
        FILTER edge._from == ${user._id}
        LET kb = DOCUMENT(PARSE_IDENTIFIER(edge._to).collection, PARSE_IDENTIFIER(edge._to).key)
        FILTER kb.isDeleted != true AND kb.orgId == ${orgId}
        RETURN { 
          kb, 
          permissions: edge.type,
          role: edge.role
        }
    `);

      const userKbs = await userKbCursor.all();

      if (userKbs.length === 0) {
        logger.warn(
          'User does not have access to any knowledge bases in this organization',
          {
            userId,
            orgId,
          },
        );
        throw new UnauthorizedError(
          `User ${userId} does not have access to any knowledge bases in organization ${orgId}`,
        );
      }

      // Check if the record exists and its relationship to the user's knowledge bases
      const kbRecordCursor = await this.db.query(aql`
      LET record = DOCUMENT(${COLLECTIONS.RECORD}, ${recordId})
      FILTER record != null AND record.isDeleted != true
      
      LET recordKbs = (
        FOR edge IN ${this.kbToRecordEdges}
          FILTER edge._from == ${COLLECTIONS.RECORD + '/' + recordId}
          LET knowledgeBaseKey = PARSE_IDENTIFIER(edge._to).key
          RETURN knowledgeBaseKey
      )
      
      LET authorizedKbs = (
        FOR userKb IN ${userKbs}
          FILTER userKb.kb._key IN recordKbs
          RETURN userKb.kb._key
      )
      
      RETURN {
        record: record,
        kbs: (
          FOR knowledgeBaseKey IN authorizedKbs
            LET kbDoc = DOCUMENT(${COLLECTIONS.KNOWLEDGEBASE}, knowledgeBaseKey)
            FILTER kbDoc.orgId == ${orgId}
            RETURN kbDoc
        ),
        permissions: (
          FOR knowledgeBaseKey IN authorizedKbs
            FOR userKbObj IN ${userKbs}
              FILTER userKbObj.kb._key == knowledgeBaseKey
              RETURN userKbObj.permissions
        )[0]
      }
    `);

      const kbRecords = await kbRecordCursor.all();

      if (kbRecords.length === 0 || !kbRecords[0].record) {
        logger.warn(
          "Record not found or not in any of the user's knowledge bases for this organization",
          { userId, orgId, recordId },
        );
        throw new NotFoundError(
          `Record ${recordId} not found in any knowledge bases accessible to user ${userId} in organization ${orgId}`,
        );
      }

      const record = kbRecords[0].record;
      const permissions = kbRecords[0].permissions;
      const kb = kbRecords[0].kbs.length > 0 ? kbRecords[0].kbs[0] : null;

      if (!kb) {
        logger.warn(
          'Knowledge base not found for record in this organization',
          { recordId, orgId },
        );
        throw new NotFoundError(
          `No knowledge base found for record ${recordId} that user ${userId} has access to in organization ${orgId}`,
        );
      }

      // Get the associated file record
      let fileRecord = null;
      try {
        // First check for is_of_type relationship
        const fileRelationCursor = await this.db.query(aql`
        FOR edge IN ${this.isOfTypeEdges}
          FILTER edge._from == ${COLLECTIONS.RECORD + '/' + recordId}
          LET fileRec = DOCUMENT(PARSE_IDENTIFIER(edge._to).collection, PARSE_IDENTIFIER(edge._to).key)
          RETURN fileRec
      `);

        const fileRecords = await fileRelationCursor.all();

        if (fileRecords.length > 0) {
          fileRecord = fileRecords[0];
        } else {
          // Fallback to direct lookup using the same ID
          try {
            fileRecord = await this.fileRecordCollection.document(recordId);
          } catch (error) {
            // File record not found with direct lookup, not an error
            logger.debug('No direct file record found for record ID', {
              recordId,
            });
          }
        }
      } catch (error) {
        logger.warn('Error looking up file record for record', {
          recordId,
          error,
        });
        // Continue without file record - it may be a non-file type record
      }

      // Get related records
      const relatedRecordsCursor = await this.db.query(aql`
      FOR edge IN ${this.recordToRecordEdges}
        FILTER edge._from == ${COLLECTIONS.RECORD + '/' + recordId} OR edge._to == ${COLLECTIONS.RECORD + '/' + recordId}
        LET otherRecord = edge._from == ${COLLECTIONS.RECORD + '/' + recordId} ? 
          DOCUMENT(${COLLECTIONS.RECORD}, PARSE_IDENTIFIER(edge._to).key) : 
          DOCUMENT(${COLLECTIONS.RECORD}, PARSE_IDENTIFIER(edge._from).key)
        FILTER otherRecord != null AND otherRecord.isDeleted != true
        RETURN {
          record: otherRecord,
          relationship: {
            type: edge.relationshipType,
            direction: edge._from == ${COLLECTIONS.RECORD + '/' + recordId} ? 'outbound' : 'inbound',
            createdAt: edge.createdAt
          }
        }
    `);

      const relatedRecords = await relatedRecordsCursor.all();

      // Build and return the response
      return {
        record: {
          ...record,
          fileRecord: fileRecord
            ? {
                name: fileRecord.name,
                extension: fileRecord.extension,
                mimeType: fileRecord.mimeType,
                sizeInBytes: fileRecord.sizeInBytes,
                isFile: fileRecord.isFile,
                webUrl : fileRecord.webUrl
              }
            : null,
        },
        knowledgeBase: {
          id: kb._key,
          name: kb.name,
          orgId: kb.orgId,
        },
        permissions,
        relatedRecords: relatedRecords.map((item) => ({
          id: item.record._key,
          name: item.record.recordName,
          type: item.record.recordType,
          relationship: item.relationship,
        })),
      };
    } catch (error) {
      logger.error('Error in getRecordById', {
        recordId,
        userId,
        orgId,
        error,
      });
      throw new InternalServerError(
        error instanceof Error ? error.message : 'Unexpected error occurred',
      );
    }
  }

  /**
   * Get records with pagination, filtering, and sorting
   * @param options Search and pagination options
   * @returns Paginated records with metadata
   */
  async getRecords(options: {
    orgId: string;
    userId: string;
    page?: number;
    limit?: number;
    search?: string;
    recordTypes?: string[];
    origins?: string[];
    indexingStatus?: string[];
    dateFrom?: number;
    dateTo?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    records: any[];
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
    };
    filters: {
      applied: Record<string, any>;
      available: Record<string, any>;
    };
  }> {
    try {
      const {
        orgId,
        userId,
        page = 1,
        limit = 20,
        search,
        recordTypes,
        origins,
        indexingStatus,
        dateFrom,
        dateTo,
        sortBy = 'createdAtTimestamp',
        sortOrder = 'desc',
      } = options;

      // Validate user has access to the knowledge base
      const { knowledgeBase: kb } = await this.validateUserKbAccess(
        userId,
        orgId,
        ['READ'],
      );

      const skip = (page - 1) * limit;

      logger.debug('Getting records with options', {
        orgId,
        userId,
        page,
        limit,
        search,
        recordTypes,
        origins,
        indexingStatus,
        dateFrom,
        dateTo,
        sortBy,
        sortOrder,
      });

      // Build the filter conditions - instead of using aql.join, we'll construct filters manually
      let filterQuery = aql`FILTER record.isDeleted != true`;

      // Add search filter if provided
      if (search) {
        filterQuery = aql`
        ${filterQuery} AND (
          LIKE(LOWER(record.recordName), ${'%' + search.toLowerCase() + '%'}) OR 
          LIKE(LOWER(record.externalRecordId), ${'%' + search.toLowerCase() + '%'})
        )
      `;
      }

      // Add record type filter if provided
      if (recordTypes && recordTypes.length > 0) {
        filterQuery = aql`${filterQuery} AND record.recordType IN ${recordTypes}`;
      }

      // Add origin filter if provided
      if (origins && origins.length > 0) {
        filterQuery = aql`${filterQuery} AND record.origin IN ${origins}`;
      }

      // Add indexing status filter if provided
      if (indexingStatus && indexingStatus.length > 0) {
        filterQuery = aql`${filterQuery} AND record.indexingStatus IN ${indexingStatus}`;
      }

      // Add date range filter if provided
      if (dateFrom) {
        filterQuery = aql`${filterQuery} AND record.createdAtTimestamp >= ${dateFrom}`;
      }

      if (dateTo) {
        filterQuery = aql`${filterQuery} AND record.createdAtTimestamp <= ${dateTo}`;
      }

      // Add organization filter - ensure records are only from the specified organization
      filterQuery = aql`${filterQuery} AND record.orgId == ${orgId}`;

      // Build the sort statement
      let sortStatement;
      const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';

      // Validate sortBy to prevent injection
      const allowedSortFields = [
        'recordName',
        'createdAtTimestamp',
        'updatedAtTimestamp',
        'recordType',
        'origin',
        'indexingStatus',
      ];

      if (!allowedSortFields.includes(sortBy)) {
        // Default to createdAtTimestamp if an invalid field is provided
        sortStatement = aql`SORT record.createdAtTimestamp DESC`;
      } else {
        // Different approach for sort statement
        if (sortBy === 'recordName') {
          sortStatement =
            sortDirection === 'ASC'
              ? aql`SORT record.recordName ASC`
              : aql`SORT record.recordName DESC`;
        } else if (sortBy === 'createdAtTimestamp') {
          sortStatement =
            sortDirection === 'ASC'
              ? aql`SORT record.createdAtTimestamp ASC`
              : aql`SORT record.createdAtTimestamp DESC`;
        } else if (sortBy === 'updatedAtTimestamp') {
          sortStatement =
            sortDirection === 'ASC'
              ? aql`SORT record.updatedAtTimestamp ASC`
              : aql`SORT record.updatedAtTimestamp DESC`;
        } else if (sortBy === 'recordType') {
          sortStatement =
            sortDirection === 'ASC'
              ? aql`SORT record.recordType ASC`
              : aql`SORT record.recordType DESC`;
        } else if (sortBy === 'origin') {
          sortStatement =
            sortDirection === 'ASC'
              ? aql`SORT record.origin ASC`
              : aql`SORT record.origin DESC`;
        } else if (sortBy === 'indexingStatus') {
          sortStatement =
            sortDirection === 'ASC'
              ? aql`SORT record.indexingStatus ASC`
              : aql`SORT record.indexingStatus DESC`;
        }
      }

      // Build the complete AQL query for records that belong to this knowledge base
      const query = aql`
      FOR edge IN ${this.kbToRecordEdges}
        FILTER edge._to == ${COLLECTIONS.KNOWLEDGEBASE + '/' + kb._key}
        LET record = DOCUMENT(PARSE_IDENTIFIER(edge._from).collection, PARSE_IDENTIFIER(edge._from).key)
        ${filterQuery}
        ${sortStatement}
        LIMIT ${skip}, ${limit}
        LET fileRecord = (
          FOR fileEdge IN ${this.isOfTypeEdges}
            FILTER fileEdge._from == record._id
            RETURN DOCUMENT(PARSE_IDENTIFIER(fileEdge._to).collection, PARSE_IDENTIFIER(fileEdge._to).key)
        )[0]
        RETURN {
          id: record._key,
          externalRecordId : record.externalRecordId,
          recordName: record.recordName,
          recordType: record.recordType,
          origin: record.origin,
          indexingStatus: record.indexingStatus,
          createdAtTimestamp: record.createdAtTimestamp,
          updatedAtTimestamp: record.updatedAtTimestamp,
          orgId: record.orgId,
          version : record.version,
          isDeleted : record.isDeleted,
          deletedByUserId : record.deletedByUserId,
          isLatestVersion : record.isLatestVersion,
          fileRecord: fileRecord ? {
            name: fileRecord.name,
            extension: fileRecord.extension,
            mimeType: fileRecord.mimeType,
            sizeInBytes: fileRecord.sizeInBytes,
            isFile: fileRecord.isFile,
            webUrl: fileRecord.webUrl
          } : null
        }
    `;

      // Execute the query to get the records
      const cursor = await this.db.query(query);
      const records = await cursor.all();

      // Get total count for pagination using a similar query but without LIMIT
      const countQuery = aql`
      FOR edge IN ${this.kbToRecordEdges}
        FILTER edge._to == ${COLLECTIONS.KNOWLEDGEBASE + '/' + kb._key}
        LET record = DOCUMENT(PARSE_IDENTIFIER(edge._from).collection, PARSE_IDENTIFIER(edge._from).key)
        ${filterQuery}
        COLLECT WITH COUNT INTO total
        RETURN total
    `;

      const countCursor = await this.db.query(countQuery);
      const countResult = await countCursor.all();
      const totalCount = countResult[0] || 0;

      // Calculate total pages
      const totalPages = Math.ceil(totalCount / limit);

      // Prepare filter metadata
      const appliedFilters: Record<string, any> = {};
      if (search) appliedFilters.search = search;
      if (recordTypes) appliedFilters.recordTypes = recordTypes;
      if (origins) appliedFilters.origins = origins;
      if (indexingStatus) appliedFilters.indexingStatus = indexingStatus;
      if (dateFrom || dateTo) {
        appliedFilters.dateRange = {
          from: dateFrom,
          to: dateTo,
        };
      }

      // Get available filter options
      // For record types
      const recordTypesCursor = await this.db.query(aql`
      FOR edge IN ${this.kbToRecordEdges}
        FILTER edge._to == ${COLLECTIONS.KNOWLEDGEBASE + '/' + kb._key}
        LET record = DOCUMENT(PARSE_IDENTIFIER(edge._from).collection, PARSE_IDENTIFIER(edge._from).key)
        FILTER record.isDeleted != true AND record.orgId == ${orgId}
        COLLECT recordType = record.recordType WITH COUNT INTO count
        RETURN { value: recordType, count: count }
    `);
      const availableRecordTypes = await recordTypesCursor.all();

      // For origins
      const originsCursor = await this.db.query(aql`
      FOR edge IN ${this.kbToRecordEdges}
        FILTER edge._to == ${COLLECTIONS.KNOWLEDGEBASE + '/' + kb._key}
        LET record = DOCUMENT(PARSE_IDENTIFIER(edge._from).collection, PARSE_IDENTIFIER(edge._from).key)
        FILTER record.isDeleted != true AND record.orgId == ${orgId}
        COLLECT origin = record.origin WITH COUNT INTO count
        RETURN { value: origin, count: count }
    `);
      const availableOrigins = await originsCursor.all();

      // For indexing statuses
      const statusCursor = await this.db.query(aql`
      FOR edge IN ${this.kbToRecordEdges}
        FILTER edge._to == ${COLLECTIONS.KNOWLEDGEBASE + '/' + kb._key}
        LET record = DOCUMENT(PARSE_IDENTIFIER(edge._from).collection, PARSE_IDENTIFIER(edge._from).key)
        FILTER record.isDeleted != true AND record.orgId == ${orgId}
        COLLECT status = record.indexingStatus WITH COUNT INTO count
        RETURN { value: status, count: count }
    `);
      const availableStatuses = await statusCursor.all();

      logger.info(`Found ${records.length} records (total: ${totalCount})`, {
        orgId,
        userId,
        page,
        limit,
      });

      // Construct and return the result
      return {
        records,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
        },
        filters: {
          applied: appliedFilters,
          available: {
            recordTypes: availableRecordTypes,
            origins: availableOrigins,
            indexingStatus: availableStatuses,
          },
        },
      };
    } catch (error) {
      logger.error('Error in getRecords', { options, error });
      throw new InternalServerError(
        error instanceof Error ? error.message : 'Unexpected error occurred',
      );
    }
  }

  /**
   * Validate that a user has access to a specific knowledge base
   * @param userId The user ID
   * @param orgId The organization ID
   * @param requiredPermissions Array of required permission types (e.g. ['READ', 'WRITE'])
   * @returns Object with knowledge base and permissions information
   */
  async validateUserKbAccess(
    userId: string,
    orgId: string,
    requiredPermissions: string[] = ['READ'],
  ): Promise<{
    knowledgeBase: any;
    permissions: string[];
    role: string;
  }> {
    try {
      if (!userId || !orgId) {
        throw new NotFoundError('User ID and organization ID are required');
      }

      logger.debug('Validating user knowledge base access', { userId, orgId });

      // Get the knowledge base for this organization
      const kb = await this.getOrCreateKnowledgeBase(orgId);

      // Find the user by userId and orgId
      let user;
      try {
        const userCursor = await this.db.query(aql`
        FOR user IN ${this.userCollection}
          FILTER user.userId == ${userId} AND user.orgId == ${orgId} AND user.isDeleted != true
          RETURN user
      `);

        const users = await userCursor.all();

        if (users.length === 0) {
          throw new NotFoundError(
            `User with ID ${userId} in organization ${orgId} not found`,
          );
        }

        user = users[0];
      } catch (error) {
        logger.error('User not found', { userId, orgId, error });
        throw new Error(
          `User with ID ${userId} in organization ${orgId} not found`,
        );
      }

      // Check if the user has permission to access this knowledge base
      const permissionCursor = await this.db.query(aql`
      FOR edge IN ${this.permissionEdges}
        FILTER edge._from == ${user._id}
          AND edge._to == ${COLLECTIONS.KNOWLEDGEBASE + '/' + kb._key}
          AND edge.isDeleted != true
        RETURN {
          permissions: edge.type,
          role: edge.role
        }
    `);

      const permissions = await permissionCursor.all();

      if (permissions.length === 0) {
        logger.warn('User does not have access to knowledge base', {
          userId,
          orgId,
          kbId: kb._key,
        });
        throw new UnauthorizedError(
          `User ${userId} does not have permission to access knowledge base for organization ${orgId}`,
        );
      }

      // Check if user has all required permissions
      const userPermissions = permissions[0].permissions || [];
      const hasAllRequiredPermissions = requiredPermissions.every(
        (permission) =>
          userPermissions.includes(permission) ||
          userPermissions.includes('OWNER'),
      );

      if (!hasAllRequiredPermissions) {
        logger.warn('User lacks required permissions', {
          userId,
          orgId,
          kbId: kb._key,
          userPermissions,
          requiredPermissions,
        });
        throw new UnauthorizedError(
          `User ${userId} does not have the required permissions (${requiredPermissions.join(', ')}) for knowledge base ${kb._key}`,
        );
      }

      logger.info('User has required knowledge base access', {
        userId,
        orgId,
        kbId: kb._key,
        permissions: userPermissions,
        role: permissions[0].role,
      });

      return {
        knowledgeBase: kb,
        permissions: userPermissions,
        role: permissions[0].role,
      };
    } catch (error) {
      logger.error('Error validating user knowledge base access', {
        userId,
        orgId,
        error,
      });
      throw new InternalServerError(
        error instanceof Error ? error.message : 'Unexpected error occurred',
      );
    }
  }

  /**
   * Updates a record with new data
   * @param recordId Record ID to update
   * @param updateData Data to update on the record
   * @returns Updated record
   */
  async updateRecord(
    recordId: string,
    updateData: any,
    keyValueStoreService: KeyValueStoreService,
  ): Promise<any> {
    try {
      logger.debug('Updating record', { recordId });

      // First check if record exists and get current data
      let existingRecord;
      try {
        existingRecord = await this.recordCollection.document(recordId);
      } catch (error) {
        logger.error('Record not found for update', { recordId, error });
        throw new NotFoundError(`Record with ID ${recordId} not found`);
      }

      // Filter out immutable properties for safety
      const safeUpdateData = { ...updateData };
      const immutableProps = [
        '_id',
        '_key',
        '_rev',
        'orgId',
        'createdAtTimestamp',
        'externalRecordId',
        'recordType',
        'origin',
      ];

      immutableProps.forEach((prop) => {
        delete safeUpdateData[prop];
      });

      // Validate allowed updates based on schema
      const allowedUpdates = [
        'recordName',
        'updatedAtTimestamp',
        'lastSyncTimestamp',
        'deletedAtSourceTimestamp',
        'sourceCreatedAtTimestamp',
        'sourceLastModifiedTimestamp',
        'lastIndexTimestamp',
        'lastExtractionTimestamp',
        'isDeletedAtSource',
        'isDeleted',
        'isArchived',
        'indexingStatus',
        'isLatestVersion',
        'isDirty',
        'version',
        'deletedByUserId',
      ];

      // Remove any update properties not in allowed list
      Object.keys(safeUpdateData).forEach((key) => {
        if (!allowedUpdates.includes(key)) {
          logger.warn(`Removing disallowed update field: ${key}`);
          delete safeUpdateData[key];
        }
      });

      // Set updated timestamp to current time
      safeUpdateData.updatedAtTimestamp = Date.now();

      // Special handling for file records
      if (existingRecord.recordType === 'FILE') {
        // Handle version incrementing for file updates
        if (safeUpdateData.version !== undefined) {
          // If version is explicitly provided, use it
          logger.debug('Using provided version number', {
            version: safeUpdateData.version,
          });
        } else {
          // For file records, always increment the version on update
          // Ensure version is a number (default to 0 if not set)
          const currentVersion =
            typeof existingRecord.version === 'number'
              ? existingRecord.version
              : 0;
          safeUpdateData.version = currentVersion + 1;
          logger.debug('Auto-incrementing file version', {
            previousVersion: currentVersion,
            newVersion: safeUpdateData.version,
          });
        }

        // If this is a file deletion, mark isLatestVersion as false
        if (safeUpdateData.isDeleted === true) {
          safeUpdateData.isLatestVersion = false;
        }
      }

      // Handle indexing status changes
      if (
        safeUpdateData.indexingStatus &&
        safeUpdateData.indexingStatus !== existingRecord.indexingStatus
      ) {
        logger.info('Updating indexing status', {
          from: existingRecord.indexingStatus,
          to: safeUpdateData.indexingStatus,
        });

        // If status is changing to COMPLETED, update lastIndexTimestamp
        if (safeUpdateData.indexingStatus === 'COMPLETED') {
          safeUpdateData.lastIndexTimestamp = Date.now();
        }
      }

      // Update the record
      const result = await this.recordCollection.update(
        recordId,
        safeUpdateData,
        {
          returnNew: true,
        },
      );

      try {
        const updatedRecord = result.new as IRecordDocument;
        const updateEventPayload = await this.createUpdateRecordEventPayload(
          updatedRecord,
          keyValueStoreService,
        );

        const event: Event = {
          eventType: EventType.UpdateRecordEvent,
          timestamp: Date.now(),
          payload: updateEventPayload,
        };

        await this.eventProducer.publishEvent(event);
        logger.info(`Published update event for record ${recordId}`);
      } catch (eventError) {
        logger.error('Failed to publish update record event', {
          recordId,
          error: eventError,
        });
        // Don't throw the error to avoid affecting the main operation
      }

      logger.info('Record updated successfully', {
        recordId,
        updatedFields: Object.keys(safeUpdateData),
        version: result.new.version,
      });

      // Handle file record update if needed
      if (existingRecord.recordType === 'FILE') {
        try {
          // Clone update data for file record
          const fileRecordUpdateData: any = {};

          // Map record fields to file record fields
          const fieldMappings: Record<string, string> = {
            recordName: 'name', // Record name -> File name
            updatedAtTimestamp: 'updatedAtTimestamp',
            isDeleted: 'isDeleted',
            deletedByUserId: 'deletedByUserId',
            deletedAtTimestamp: 'deletedAtTimestamp',
            version: 'version',
            isLatestVersion: 'isLatestVersion',
          };

          // Copy mapped fields to file record update
          Object.entries(fieldMappings).forEach(([recordField, fileField]) => {
            if (safeUpdateData[recordField] !== undefined) {
              fileRecordUpdateData[fileField] = safeUpdateData[recordField];
            }
          });

          if (Object.keys(fileRecordUpdateData).length > 0) {
            // Check if file record exists before updating
            try {
              await this.fileRecordCollection.document(recordId);
              await this.fileRecordCollection.update(
                recordId,
                fileRecordUpdateData,
              );
              logger.info('File record updated successfully', {
                recordId,
                updatedFields: Object.keys(fileRecordUpdateData),
              });
            } catch (fileError) {
              logger.warn('File record not found for update', {
                recordId,
                fileError,
              });
            }
          }
        } catch (error) {
          logger.warn('Failed to update associated file record', {
            recordId,
            error,
          });
          // Continue with the main record update even if file record update fails
        }
      }

      return result.new;
    } catch (error) {
      logger.error('Error updating record', { recordId, error });
      throw new InternalServerError(
        error instanceof Error ? error.message : 'Unexpected error occurred',
      );
    }
  }

  /**
   * Soft-deletes a record by setting isDeleted flag
   * @param recordId Record ID to delete
   * @param userId User performing the deletion
   * @returns Deletion status
   */
  async softDeleteRecord(recordId: string, userId: string): Promise<boolean> {
    try {
      logger.debug('Soft deleting record', { recordId, userId });

      // First check if record exists
      let record;
      try {
        record = await this.recordCollection.document(recordId);
      } catch (error) {
        logger.error('Record not found for deletion', { recordId, error });
        throw new NotFoundError(`Record with ID ${recordId} not found`);
      }

      // Check if already deleted
      if (record.isDeleted) {
        logger.info('Record is already deleted', { recordId });
        throw new NotFoundError(`Record with ID ${recordId} not found`);
      }

      // Update the record to set deleted flag
      const updateData = {
        isDeleted: true,
        deletedByUserId: userId,
        // deletedAtTimestamp: Date.now(),
        updatedAtTimestamp: Date.now(),
      };

      await this.recordCollection.update(recordId, updateData);

      // Also mark the file record as deleted if it exists
      try {
        const fileRecord = await this.fileRecordCollection.document(recordId);
        if (fileRecord) {
          await this.fileRecordCollection.update(recordId, updateData);
          logger.info('Associated file record marked as deleted', { recordId });
        }
      } catch (error) {
        // Ignore errors if file record doesn't exist
        logger.debug('No associated file record found for deletion', {
          recordId,
        });
      }

      try {
        // Fetch the updated record to include all necessary data
        const updatedRecord = await this.recordCollection.document(recordId);

        const deleteEventPayload =
          this.createDeletedRecordEventPayload(updatedRecord);

        const event: Event = {
          eventType: EventType.DeletedRecordEvent,
          timestamp: Date.now(),
          payload: deleteEventPayload,
        };

        await this.eventProducer.publishEvent(event);
        logger.info(`Published delete event for record ${recordId}`);
      } catch (eventError) {
        logger.error('Failed to publish delete record event', {
          recordId,
          error: eventError,
        });
        // Don't throw the error to avoid affecting the main operation
      }

      logger.info('Record soft deleted successfully', { recordId, userId });
      return true;
    } catch (error) {
      logger.error('Error soft deleting record', { recordId, error });
      throw new InternalServerError(
        error instanceof Error ? error.message : 'Unexpected error occurred',
      );
    }
  }
}
