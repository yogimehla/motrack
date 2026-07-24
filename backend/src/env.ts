export const env = {
  PORT: Number(process.env.PORT || 4010),
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret',
  MOINVOICE_KEY: process.env.MOINVOICE_KEY || 'dev-key',
  DB_PATH: process.env.DB_PATH || new URL('../data/muulroute.db', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
};
