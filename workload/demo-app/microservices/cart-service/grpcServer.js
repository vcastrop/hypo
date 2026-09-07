import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import redis from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROTO_PATH = path.join(__dirname, '..', 'proto', 'cart.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true,
});
const cartProto = grpc.loadPackageDefinition(packageDefinition).cart;

async function clearCart(call, callback) {
  try {
    const userId = call.request.user_id;
    await redis.del(`cart:${userId}`);
    console.log(`gRPC ClearCart: cleared cart for user ${userId}`);
    callback(null, { success: true, message: 'Cart cleared' });
  } catch (err) {
    console.error('gRPC ClearCart error:', err);
    callback({ code: grpc.status.INTERNAL, message: err.message });
  }
}

export function startGrpcServer() {
  const server = new grpc.Server();
  server.addService(cartProto.CartService.service, { ClearCart: clearCart });
  const GRPC_PORT = process.env.GRPC_PORT || '50052';
  server.bindAsync(`0.0.0.0:${GRPC_PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) { console.error('Failed to start cart gRPC server:', err); return; }
    console.log(`Cart gRPC server running on port ${port}`);
  });
}