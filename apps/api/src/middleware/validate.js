import { badRequest } from '../utils/errors.js';

/** Validate req[source] against a zod schema and replace it with the parsed value. */
export const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      return next(badRequest('Invalid input', details));
    }
    if (source === 'query') req.validQuery = result.data;
    else req[source] = result.data;
    next();
  };
