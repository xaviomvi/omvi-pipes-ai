export interface AppConfig {
  jwtSecret: string;
  scopedJwtSecret: string;
  encryption: {
    key: string;
    algorithm: string;
  };
  kafka: {
    clientId: string;
    brokers: string[];
    groupId: string;
    ssl: boolean;
    sasl?: {
      mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
      username: string;
      password: string;
    };
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  database: {
    url: string;
  };
  etcd: {
    host: string;
    port: number;
    dialTimeout: number;
  };
}

export const loadAppConfig = (): AppConfig => {
  return {
    jwtSecret: process.env.JWT_SECRET!,
    scopedJwtSecret: process.env.SCOPED_JWT_SECRET!,
    encryption: {
      key: process.env.ENCRYPTION_KEY!,
      algorithm: 'aes-256-gcm',
    },
    kafka: {
      clientId: process.env.KAFKA_CLIENT_ID!,
      brokers: process.env.KAFKA_BROKERS!.split(','),
      groupId: process.env.KAFKA_GROUP_ID!,
      ssl: process.env.KAFKA_SSL === 'true',
      ...(process.env.KAFKA_USERNAME && {
        sasl: {
          mechanism: 'plain' as const,
          username: process.env.KAFKA_USERNAME,
          password: process.env.KAFKA_PASSWORD!,
        },
      }),
    },
    redis: {
      host: process.env.REDIS_HOST!,
      port: parseInt(process.env.REDIS_PORT!, 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0', 10),
    },
    database: {
      url: process.env.DATABASE_URL!,
    },
    etcd: {
      host: process.env.ETCD_HOST!,
      port: parseInt(process.env.ETCD_PORT!, 10),
      dialTimeout: parseInt(process.env.ETCD_DIAL_TIMEOUT!, 10),
    },
  };
};
