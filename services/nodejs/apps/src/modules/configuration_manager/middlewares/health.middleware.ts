import { Response, NextFunction } from 'express';
import { Kafka } from 'kafkajs';
import Redis from 'ioredis';
import { MongoClient } from 'mongodb';
import { Database } from 'arangojs';
import { AuthenticatedUserRequest } from '../../../libs/middlewares/types';
import {
  BadRequestError,
  InternalServerError,
} from '../../../libs/errors/http.errors';
import { Logger } from '../../../libs/services/logger.service';

const logger = Logger.getInstance({
  service: 'Health Middleware',
});

// ✅ Qdrant Configuration
// const qdrant = new QdrantClient({ url: "http://localhost:6333" });

export const checkKafkaHealth = async (
  req: AuthenticatedUserRequest,
  _res: Response,
  next: NextFunction,
) => {
  try {
    let brokers = req.body.brokers;

    // Ensure brokers is always an array
    if (typeof brokers === 'string') {
      brokers = [brokers]; // Convert single string to an array
    }

    if (!Array.isArray(brokers) || brokers.length === 0) {
      throw new BadRequestError(
        "Invalid brokers list: Must be a non-empty array of 'host:port' strings.",
      );
    }

    // Ensure each broker is properly formatted
    for (const broker of brokers) {
      if (typeof broker !== 'string' || !broker.includes(':')) {
        throw new BadRequestError(
          `Invalid broker format: "${broker}". Expected "host:port".`,
        );
      }
    }

    logger.info('Connecting to Kafka brokers:', brokers);

    const kafka = new Kafka({ brokers });
    const kafkaAdmin = kafka.admin();
    await kafkaAdmin.connect();

    // Try listing topics to confirm the connection
    await kafkaAdmin.listTopics();
    await kafkaAdmin.disconnect();

    logger.info('✅ Kafka is active');
    next();
  } catch (error) {
    logger.error('❌ Kafka connection error:', error);
    return next(error);
  }
};

// Store a reusable Redis connection
export const checkRedisHealth = async (
  req: AuthenticatedUserRequest,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const { host, port, password, tls } = req.body;

    // Validate required fields
    if (!host || !port) {
      throw new BadRequestError('Missing Redis host or port.');
    }

    // Construct Redis URL
    let redisUrl = `redis://`;
    if (password) redisUrl += `:${password}@`;
    redisUrl += `${host}:${port}`;
    if (tls) redisUrl = redisUrl.replace('redis://', 'rediss://');

    // Create Redis client with error handling
    const redisClient = new Redis(redisUrl, {
      connectTimeout: 5000, // Timeout in 5 seconds
      maxRetriesPerRequest: 1, // Retry only once
      retryStrategy: (times) => {
        if (times >= 2) return null; // Stop retrying after 2 attempts
        return Math.min(times * 500, 3000); // Retry delay (500ms, 1000ms)
      },
    });

    // Handle connection errors
    redisClient.on('error', (error) => {
      throw new BadRequestError('Failed to connect to Redis', error);
    });

    // Ensure Redis is ready before proceeding
    await new Promise((resolve, reject) => {
      redisClient.once('ready', resolve);
      redisClient.once('error', reject);
    });
    next(); // Move to next middleware
  } catch (error) {
    next(error); // Pass error to Express error handler
  }
};

// // 🛠 Qdrant Health Check
// const checkQdrantHealth = async (req:AuthenticatedUserRequest,res:Response,next:NextFunction) => {
//     try {
//         await qdrant.getCollections();
//     } catch (error) {
//         next(error);
//     }
// };

// 🛠 MongoDB Health Check

export const checkMongoHealth = async (
  req: AuthenticatedUserRequest,
  _res: Response,
  next: NextFunction,
) => {
  const mongoURI = req.body.uri;
  const dbName = req.body.db;

  if (!mongoURI || !dbName) {
    throw new BadRequestError('Missing MongoDB URI or Database Name');
  }

  const client = new MongoClient(mongoURI); // Removed outdated options

  try {
    await client.connect();

    const db = client.db(dbName);
    const admin = db.admin();
    const status = await admin.command({ ping: 1 });

    if (status.ok !== 1) {
      throw new InternalServerError('Database is not responding');
    }
  } catch (error) {
    next(error);
  } finally {
    await client.close();
    next();
  }
};

// 🛠 ArangoDB Health Check
export const checkArangoHealth = async (
  req: AuthenticatedUserRequest,
  _res: Response,
  next: NextFunction,
) => {
  const { uri, username, password } = req.body;
  const arangoDB = new Database({ url: uri, timeout: 2000 });
  if (username && password) {
    arangoDB.useBasicAuth(username, password);
  }
  try {
    await arangoDB.exists();
  } catch (error) {
    next(error);
  }
};
