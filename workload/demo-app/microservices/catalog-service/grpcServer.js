import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Book from './models/Book.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveProto() {
  const candidates = [
    path.join(__dirname, 'catalog.proto'),
    path.join(__dirname, '..', 'proto', 'catalog.proto'),
    '/usr/src/proto/catalog.proto',
    '/proto/catalog.proto',
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(`catalog.proto not found. Tried: ${candidates.join(', ')}`);
  }
  return found;
}

const PROTO_PATH = resolveProto();
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true,
});
const catalogProto = grpc.loadPackageDefinition(packageDefinition).catalog;

async function getBook(call, callback) {
  try {
    const book = await Book.findById(call.request.id);
    if (book) {
      callback(null, {
        id: String(book._id),
        name: book.name,
        author: book.author || '',
        description: book.description || '',
        price: book.price || '',
        countInStock: book.countInStock || 0,
        image: book.image || '',
        found: true,
      });
    } else {
      callback(null, { found: false });
    }
  } catch (err) {
    console.error('gRPC GetBook error:', err);
    callback({ code: grpc.status.INTERNAL, message: err.message });
  }
}

export function startGrpcServer() {
  const server = new grpc.Server();
  server.addService(catalogProto.CatalogService.service, { GetBook: getBook });
  const GRPC_PORT = process.env.GRPC_PORT || '50051';
  server.bindAsync(`0.0.0.0:${GRPC_PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) {
      console.error('Failed to start catalog gRPC server:', err);
      return;
    }
    try {
      server.start();
    } catch {
      // bindAsync already starts the server in newer @grpc/grpc-js
    }
    console.log(`Catalog gRPC server running on port ${port}`);
  });
}
