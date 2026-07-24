import { MoInvoiceOrderSource } from './MoInvoiceOrderSource.js';
import { CsvOrderSource } from './CsvOrderSource.js';

export type { IOrderSource, IncomingOrder } from './IOrderSource.js';
export { MoInvoiceOrderSource } from './MoInvoiceOrderSource.js';
export { CsvOrderSource } from './CsvOrderSource.js';

export const moInvoiceOrderSource = new MoInvoiceOrderSource();
export const csvOrderSource = new CsvOrderSource();
