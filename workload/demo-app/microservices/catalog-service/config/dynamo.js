import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { fromEnv } from "@aws-sdk/credential-providers";

const region = process.env.AWS_REGION || "us-east-1";
const profile = process.env.AWS_PROFILE || "default";
const environment = process.env.NODE_ENV || "dev";

let clientConfig = { region };

if (environment === "production") {
  console.log("Running application in production mode...");
} else {
  console.log("Running application in DEV mode using fromEnv()...");
  clientConfig.credentials = fromEnv();
}

const client = new DynamoDBClient(clientConfig);
const docClient = DynamoDBDocumentClient.from(client);

export default docClient;
