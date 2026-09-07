import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROTO_PATH = path.join(__dirname, "..", "proto", "catalog.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const catalogProto = grpc.loadPackageDefinition(packageDefinition).catalog;

const CATALOG_GRPC_URL = process.env.CATALOG_GRPC_URL || "catalog_service:50051";

const client = new catalogProto.CatalogService(
  CATALOG_GRPC_URL,
  grpc.credentials.createInsecure()
);

// Returns a promise with the book data
export function getBookById(bookId) {
  return new Promise((resolve, reject) => {
    client.GetBook({ id: bookId }, (err, response) => {
      if (err) {
        reject(err);
      } else {
        resolve(response);
      }
    });
  });
}
