# Resumen de Implementación gRPC

## ¿Qué hicimos?
Agregamos comunicación **gRPC** (más rápida y eficiente que REST) exclusivamente para la comunicación **entre microservicios** (Backend ↔ Backend). 
El Frontend sigue usando REST (HTTP/JSON) para comunicarse con el API Gateway.

## Flujos gRPC
1. **Cart → Catalog (`GetBook`)**: Antes de agregar un libro al carrito, Cart consulta por gRPC al Catalog para asegurar que el libro exista.
2. **Order → Catalog (`GetBook`)**: Al crear una orden, Order consulta por gRPC al Catalog para obtener el precio actual.
3. **Order → Cart (`ClearCart`)**: Después de confirmar una orden, Order le pide por gRPC a Cart que limpie el carrito del usuario.

## Puertos y Servicios
| Servicio | REST | gRPC | Función gRPC |
|---|---|---|---|
| Catalog | 5001 | **50051** | Servidor (`GetBook`) |
| Cart | 5003 | **50052** | Cliente (`GetBook`) y Servidor (`ClearCart`) |
| Order | 5004 | — | Cliente (`GetBook`, `ClearCart`) |

## ¿Cómo probarlo?
La variable `COMM_MODE=grpc` ya está configurada en el `docker-compose-dev.yml` para los servicios de Cart y Order.

Para probar todo:
1. Inicia los contenedores recreando las imágenes (para que se copien los nuevos archivos):
   ```bash
   docker compose -f docker-compose-dev.yml up --build
   ```
2. Desde el frontend, agrega un libro al carrito (comprobará usando gRPC).
3. Ve al carrito y realiza la compra (creará la orden con datos de gRPC y limpiará el carrito por gRPC).
4. Revisa los logs en la terminal, deberías ver mensajes como:
   `gRPC ClearCart: cleared cart for user...`
