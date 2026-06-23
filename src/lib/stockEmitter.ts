import { EventEmitter } from 'events';

class StockEmitter extends EventEmitter {
  emitUpdate(productId: number, stock: number) {
    this.emit('update', { productId, stock });
  }
}

const globalForStock = global as typeof globalThis & {
  stockEmitter?: StockEmitter;
};

export const stockEmitter = globalForStock.stockEmitter ?? new StockEmitter();

if (process.env.NODE_ENV !== 'production') {
  globalForStock.stockEmitter = stockEmitter;
}
