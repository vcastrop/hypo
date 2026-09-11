import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveProto(filename) {
  const candidates = [
    path.join(__dirname, filename),
    path.join(__dirname, "..", "proto", filename),
    `/proto/${filename}`,
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(`${filename} not found. Tried: ${candidates.join(", ")}`);
  }
  return found;
}

const PROTO_PATH = resolveProto("catalog.proto");

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

export function getBookById(bookId) {
  return new Promise((resolve, reject) => {
    client.GetBook({ id: String(bookId) }, (err, response) => {
      if (err) {
        reject(err);
      } else {
        resolve(response);
      }
    });
  });
}
