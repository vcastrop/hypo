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

const catalogPkgDef = protoLoader.loadSync(resolveProto("catalog.proto"), {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const catalogProto = grpc.loadPackageDefinition(catalogPkgDef).catalog;
const CATALOG_GRPC_URL = process.env.CATALOG_GRPC_URL || "catalog_service:50051";
const catalogClient = new catalogProto.CatalogService(
  CATALOG_GRPC_URL,
  grpc.credentials.createInsecure()
);

const cartPkgDef = protoLoader.loadSync(resolveProto("cart.proto"), {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const cartProto = grpc.loadPackageDefinition(cartPkgDef).cart;
const CART_GRPC_URL = process.env.CART_GRPC_URL || "cart_service:50052";
const cartClient = new cartProto.CartService(
  CART_GRPC_URL,
  grpc.credentials.createInsecure()
);

export function getBookById(bookId) {
  return new Promise((resolve, reject) => {
    catalogClient.GetBook({ id: String(bookId) }, (err, response) => {
      if (err) {
        reject(err);
      } else {
        resolve(response);
      }
    });
  });
}

export function clearCart(userId) {
  return new Promise((resolve, reject) => {
    cartClient.ClearCart({ user_id: String(userId) }, (err, response) => {
      if (err) {
        reject(err);
      } else {
        resolve(response);
      }
    });
  });
}
