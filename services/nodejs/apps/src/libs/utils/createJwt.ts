import jwt from 'jsonwebtoken';
import { TokenScopes } from '../enums/token-scopes.enum';

export const mailJwtGenerator = (email: string, jwtSecret: string) => {
  return jwt.sign(
    { email: email, scopes: [TokenScopes.SEND_MAIL] },
    jwtSecret,
    {
      expiresIn: '1h',
    },
  );
};

export const jwtGeneratorForForgotPasswordLink = (
  userEmail: string,
  userId: string,
  orgId: string,
  jwtSecret: string,
) => {
  // Token for password reset
  const passwordResetToken = jwt.sign(
    {
      userEmail,
      userId,
      orgId,
      scopes: [TokenScopes.PASSWORD_RESET],
    },
    jwtSecret,
    { expiresIn: '1h' },
  );
  const mailAuthToken = jwt.sign(
    {
      userEmail,
      userId,
      orgId,
      scopes: [TokenScopes.SEND_MAIL],
    },
    jwtSecret,
    { expiresIn: '1h' },
  );

  return { passwordResetToken, mailAuthToken };
};

export const refreshTokenJwtGenerator = (
  userId: string,
  orgId: string,
  jwtSecret: string,
) => {
  return jwt.sign(
    { userId: userId, orgId: orgId, scopes: [TokenScopes.TOKEN_REFRESH] },
    jwtSecret,
    { expiresIn: '720h' },
  );
};

export const iamJwtGenerator = (email: string, jwtSecret: string) => {
  return jwt.sign(
    { email: email, scopes: [TokenScopes.USER_LOOKUP] },
    jwtSecret,
    { expiresIn: '1h' },
  );
};

export const iamUserLookupJwtGenerator = (
  userId: string,
  orgId: string,
  jwtSecret: string,
) => {
  return jwt.sign(
    { userId, orgId, scopes: [TokenScopes.USER_LOOKUP] },
    jwtSecret,
    { expiresIn: '1h' },
  );
};

export const authJwtGenerator = (
  jwtSecret: string,
  email?: string | null,
  userId?: string | null,
  orgId?: string | null,
  fullName?: string | null,
  accountType?: string | null,
) => {
  return jwt.sign({ userId, orgId, email, fullName, accountType }, jwtSecret, {
    expiresIn: '24h',
  });
};

export const fetchConfigJwtGenerator = (
  userId: string,
  orgId: string,
  jwtSecret: string,
) => {
  return jwt.sign(
    { userId, orgId, scopes: [TokenScopes.FETCH_CONFIG] },
    jwtSecret,
    { expiresIn: '1h' },
  );
};
