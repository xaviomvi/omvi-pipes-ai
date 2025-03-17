import { injectable } from 'inversify';
import { v4 as uuidv4 } from 'uuid';

import {
  ICreateTokenReference,
  ITokenReference,
  TokenReferenceModel,
} from '../schema/token-reference.schema';
import { Logger } from '../../../libs/services/logger.service';

const logger = Logger.getInstance({
  service: 'Token Reference Service',
});

@injectable()
export class TokenReferenceService {
  constructor() {}

  async createTokenReference(
    data: ICreateTokenReference,
  ): Promise<ITokenReference> {
    logger.info('Token reference data', data);
    return await TokenReferenceModel.create({
      ...data,
      tokenId: uuidv4(),
    });
  }

  async updateTokenReference(
    tokenId: string,
    updates: Partial<ICreateTokenReference>,
  ): Promise<ITokenReference | null> {
    return await TokenReferenceModel.findOneAndUpdate(
      { tokenId },
      { $set: updates },
      { new: true },
    );
  }

  async deleteTokenReference(tokenId: string): Promise<void> {
    await TokenReferenceModel.deleteOne({ tokenId });
  }

  async getTokenReference(tokenId: string): Promise<ITokenReference | null> {
    return await TokenReferenceModel.findOne({ tokenId });
  }
}
