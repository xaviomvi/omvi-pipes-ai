import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

import { Org } from '../schema/org.schema';
import { Users } from '../schema/users.schema';
import { UserGroups } from '../schema/userGroup.schema';
import { AuthenticatedUserRequest } from '../../../libs/middlewares/types';
import { OrgLogos } from '../schema/orgLogo.schema';
import sharp from 'sharp';
import { inject, injectable } from 'inversify';
import { MailService } from '../services/mail.service';
import {
  AuthMethodType,
  OrgAuthConfig,
} from '../../auth/schema/orgAuthConfiguration.schema';
import { UserCredentials } from '../../auth/schema/userCredentials.schema';
import { passwordValidator } from '../../auth/utils/passwordValidator';
import { SALT_ROUNDS } from '../../auth/controller/userAccount.controller';
import {
  BadRequestError,
  InternalServerError,
  LargePayloadError,
  NotFoundError,
} from '../../../libs/errors/http.errors';
import { Logger } from '../../../libs/services/logger.service';
import { PrometheusService } from '../../../libs/services/prometheus/prometheus.service';
import { ContainerRequest } from '../../auth/middlewares/types';
import {
  EntitiesEventProducer,
  Event,
  EventType,
  OrgAddedEvent,
  OrgDeletedEvent,
  OrgUpdatedEvent,
  UserAddedEvent,
} from '../services/entity_events.service';
import { mailJwtGenerator } from '../../../libs/utils/createJwt';
import { AppConfig } from '../../tokens_manager/config/config';

@injectable()
export class OrgController {
  constructor(
    @inject('AppConfig') private config: AppConfig,
    @inject('MailService') private mailService: MailService,
    @inject('Logger') private logger: Logger,
    @inject('EntitiesEventProducer')
    private eventService: EntitiesEventProducer,
  ) {}

  getDomainFromEmail(email: string) {
    const parts = email.split('@');

    if (parts.length !== 2) {
      return null; // Invalid email format
    }

    // The domain is the second part of the split
    const domain = parts[1];

    return domain;
  }

  async checkOrgExistence(res: Response): Promise<void> {
    const count = await Org.countDocuments();

    res.status(200).json({ exists: count != 0 });
  }

  async createOrg(req: ContainerRequest, res: Response): Promise<void> {
    const container = req.container;
    if (!container) {
      throw new NotFoundError('Container not found');
    }

    const prometheusService =
      container.get<PrometheusService>(PrometheusService);

    let session: mongoose.ClientSession | null = null;
    try {
      const { contactEmail, adminFullName, password, sendEmail } = req.body;

      if (!passwordValidator(password)) {
        throw new BadRequestError(
          'Password should have minimum 8 characters with at least one uppercase, one lowercase, one number and one special character',
        );
      }

      const count = await Org.countDocuments();
      if (count > 0) {
        throw new BadRequestError('There is already an organization');
      }
      const domain = this.getDomainFromEmail(contactEmail);
      if (!domain) {
        throw new BadRequestError(
          'Please specify a correct domain name. e.g. emailname@example.com',
        );
      }

      const org = new Org({
        ...req.body,
        domain,
        onBoardingStatus: 'notConfigured', // Set default onboarding status when org is created
      });

      const adminUser = new Users({
        fullName: adminFullName,
        email: contactEmail,
        orgId: org._id,
      });

      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

      const adminUserCredentials = new UserCredentials({
        userId: adminUser._id,
        orgId: org._id,
        isDeleted: false,
        hashedPassword,
        ipAddress: req.ip,
      });

      const adminUserGroup = new UserGroups({
        type: 'admin',
        name: 'admin',
        orgId: org._id,
        users: [adminUser._id],
      });

      const orgAuthConfig = new OrgAuthConfig({
        orgId: org._id,
        authSteps: [
          {
            order: 1,
            allowedMethods: [{ type: AuthMethodType.PASSWORD }],
          },
        ],
      });

      const rsAvailable = this.config.rsAvailable === 'true';
      if (rsAvailable) {
        session = await mongoose.startSession();

        session.startTransaction();
        await orgAuthConfig.save({ session });
        await adminUserGroup.save({ session });
        await adminUser.save({ session });
        await adminUserCredentials.save({ session });
        await org.save({ session });
        await session.commitTransaction();
      } else {
        await orgAuthConfig.save();
        await adminUserGroup.save();
        await adminUser.save();
        await adminUserCredentials.save();
        await org.save();
      }
      // create an activity for metrics
      prometheusService.recordUserActivity(
        'Org created',
        adminUser._id as string,
        org._id as string,
        contactEmail,
      );

      if (sendEmail) {
        await this.mailService.sendMail({
          emailTemplateType: 'accountCreation',
          initiator: {
            jwtAuthToken: mailJwtGenerator(
              contactEmail,
              this.config.scopedJwtSecret,
            ),
          },
          usersMails: [contactEmail],
          subject: 'New Org Account Creation',
          templateData: {
            invitee: 'Pipeshub',
            name: 'User',
            orgname: org.registeredName,
            link: `${this.config.frontendUrl}`,
          },
        });
      }

      await this.eventService.start();
      let event: Event = {
        eventType: EventType.OrgCreatedEvent,
        timestamp: Date.now(),
        payload: {
          orgId: org._id,
          accountType: org.accountType,
          registeredName: org.registeredName,
        } as OrgAddedEvent,
      };
      await this.eventService.publishEvent(event);

      event = {
        eventType: EventType.NewUserEvent,
        timestamp: Date.now(),
        payload: {
          orgId: adminUser.orgId.toString(),
          userId: adminUser._id,
          fullName: adminUser.fullName,
          email: adminUser.email,
          syncAction: 'none',
        } as UserAddedEvent,
      };
      await this.eventService.publishEvent(event);

      await this.eventService.stop();
      res.status(200).json(org);
    } catch (error) {
      throw new InternalServerError(
        error instanceof Error ? error.message : 'Error retrieving users',
      );
    } finally {
      if (session) {
        session.endSession();
      }
    }
  }

  async getOrganizationById(
    req: AuthenticatedUserRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const orgId = req.user?.orgId;
    this.logger.info(orgId);
    try {
      const org = await Org.findOne({ orgId, isDeleted: false });

      if (!org) {
        throw new NotFoundError('Organisation not found');
      }
      res.status(200).json(org);
      return;
    } catch (error) {
      next(error);
    }
  }

  async updateOrganizationDetails(
    req: AuthenticatedUserRequest,
    res: Response,
    next: NextFunction,
    prometheusService: PrometheusService,
  ): Promise<void> {
    const { contactEmail, registeredName, shortName, permanentAddress } =
      req.body as {
        contactEmail?: string;
        registeredName?: string;
        shortName?: string;
        permanentAddress?: string;
      };

    try {
      const orgId = req.user?.orgId;

      const org = await Org.findOne({ orgId, isDeleted: false });

      if (!org) {
        throw new NotFoundError('Organisation not found');
      }

      // Update only the fields that are provided in the request body
      const updateData: Partial<{
        contactEmail: string;
        registeredName: string;
        shortName: string;
        permanentAddress: string;
      }> = {};

      if (contactEmail) updateData.contactEmail = contactEmail;
      if (registeredName) updateData.registeredName = registeredName;
      if (shortName) updateData.shortName = shortName;
      if (permanentAddress) updateData.permanentAddress = permanentAddress;

      // Perform the update
      const updatedOrg = await Org.findByIdAndUpdate(orgId, updateData, {
        new: true,
      });
      // metric collection
      prometheusService.recordOrgActivity(
        'Org Updated',
        orgId,
        contactEmail as string,
      );

      await this.eventService.start();
      let event: Event = {
        eventType: EventType.OrgUpdatedEvent,
        timestamp: Date.now(),
        payload: {
          orgId: org._id,
          registeredName: org.registeredName,
        } as OrgUpdatedEvent,
      };
      await this.eventService.publishEvent(event);

      await this.eventService.stop();

      res.status(200).json({
        message: 'Organization updated successfully',
        data: updatedOrg,
      });
      return;
    } catch (error) {
      next(error);
    }
  }

  async deleteOrganization(
    req: AuthenticatedUserRequest,
    res: Response,
    next: NextFunction,
    prometheusService: PrometheusService,
  ): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      const org = await Org.findOne({ orgId, isDeleted: false });

      if (!org) {
        throw new NotFoundError('Organisation not found');
      }

      // Soft delete: set isDeleted to true
      org.isDeleted = true;
      await org.save();
      // metric collection
      prometheusService.recordOrgActivity(
        'Org Deleted',
        orgId,
        org.contactEmail as string,
      );

      await this.eventService.start();
      let event: Event = {
        eventType: EventType.OrgDeletedEvent,
        timestamp: Date.now(),
        payload: {
          orgId: org._id,
        } as OrgDeletedEvent,
      };
      await this.eventService.publishEvent(event);

      await this.eventService.stop();

      res.status(200).json({
        message: 'Organization marked as deleted successfully',
        data: org,
      });
      return;
    } catch (error) {
      next(error);
    }
  }

  async updateOrgLogo(
    req: AuthenticatedUserRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.files || req.files.length == 0) {
        throw new BadRequestError('Organisation logo file is required');
      }
      let logoFile: Express.Multer.File | undefined;

      if (Array.isArray(req.files)) {
        logoFile = req.files[0];
      } else {
        const fieldFiles = Object.values(req.files)[0];
        if (Array.isArray(fieldFiles)) {
          logoFile = fieldFiles[0];
        }
      }

      const orgId = req.user?.orgId;
      if (!logoFile) {
        throw new BadRequestError('Organisation logo file is required');
      }

      if (logoFile.size > 1048576) {
        throw new LargePayloadError('File too large , limit:1MB');
      }
      let quality = 100; // Start with 100% quality
      let compressedImageBuffer = await sharp(logoFile.buffer)
        .jpeg({ quality }) // Initial compression
        .toBuffer();

      // Keep reducing quality until file size is below 100KB
      while (compressedImageBuffer.length > 100 * 1024 && quality > 10) {
        quality -= 10;
        compressedImageBuffer = await sharp(logoFile.buffer)
          // Resize to 300x300
          .jpeg({ quality }) // Reduce quality dynamically
          .toBuffer();
      }

      if (compressedImageBuffer.length > 100 * 1024) {
        throw new LargePayloadError('File too large , limit:1MB');
      }
      const compressedPic = compressedImageBuffer.toString('base64');
      const compressedPicMimeType = 'image/jpeg';
      await OrgLogos.findOneAndUpdate(
        {
          orgId,
        },
        { orgId, logo: compressedPic, mimeType: compressedPicMimeType },
        { new: true, upsert: true },
      );

      res.setHeader('Content-Type', compressedPicMimeType);
      res.status(201).send(compressedImageBuffer);
      return;
    } catch (error) {
      next(error);
    }
  }

  async getOrgLogo(
    req: AuthenticatedUserRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const orgId = req.user?.orgId;

      const orgLogo = await OrgLogos.findOne({ orgId }).lean().exec();

      if (!orgLogo || !orgLogo.logo) {
        throw new NotFoundError('Organisation logo not found');
      }

      const logoBuffer = Buffer.from(orgLogo.logo, 'base64');
      if (orgLogo.mimeType) {
        res.setHeader('Content-Type', orgLogo.mimeType);
      }

      res.status(200).send(logoBuffer);
      return;
    } catch (error) {
      next(error);
    }
  }

  async removeOrgLogo(
    req: AuthenticatedUserRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const orgId = req.user?.orgId;
      const orgLogo = await OrgLogos.findOne({ orgId }).exec();
      if (!orgLogo) {
        throw new NotFoundError('Organisation logo not found');
      }

      orgLogo.logo = null;
      orgLogo.mimeType = null;

      await orgLogo.save();

      res.status(200).send(orgLogo);
      return;
    } catch (error) {
      next(error);
    }
  }

  async getOnboardingStatus(
    req: AuthenticatedUserRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const orgId = req.user?.orgId;

      const org = await Org.findOne({ _id: orgId, isDeleted: false })
        .select('onBoardingStatus')
        .lean();

      if (!org) {
        throw new NotFoundError('Organisation not found');
      }

      res.status(200).json({
        status: org.onBoardingStatus || 'notConfigured',
      });
      return;
    } catch (error) {
      next(error);
    }
  }

  async updateOnboardingStatus(
    req: AuthenticatedUserRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { status } = req.body;
      const orgId = req.user?.orgId;

      // Validate status value
      if (!['configured', 'notConfigured', 'skipped'].includes(status)) {
        throw new BadRequestError(
          'Invalid onboarding status. Must be one of: configured, notConfigured, skipped',
        );
      }

      const org = await Org.findOne({ _id: orgId, isDeleted: false });

      if (!org) {
        throw new NotFoundError('Organisation not found');
      }

      // Update the onboarding status
      org.onBoardingStatus = status;
      await org.save();

      res.status(200).json({
        message: 'Onboarding status updated successfully',
        status: org.onBoardingStatus,
      });

      return;
    } catch (error) {
      next(error);
    }
  }
}
