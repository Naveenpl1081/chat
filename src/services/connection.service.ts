import { APIGatewayProxyResultV2 } from "aws-lambda";
import { PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../config/dynamo";

const TABLE_NAME = process.env.TABLE_NAME || "ChatConnections";

export const connectUser = async (
  event: any
): Promise<APIGatewayProxyResultV2> => {
  const { connectionId } = event.requestContext;
  const groupId = event.queryStringParameters?.groupId;

  if (!groupId) {
    return { statusCode: 400, body: "Missing groupId" };
  }

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        groupId,
        connectionId,
        connectedAt: new Date().toISOString(),
      },
    })
  );

  return { statusCode: 200, body: "Connected" };
};

export const disconnectUser = async (
  event: any
): Promise<APIGatewayProxyResultV2> => {
  const { connectionId } = event.requestContext;
  const groupId = event.queryStringParameters?.groupId;

  if (!groupId) {
    return { statusCode: 200, body: "Disconnected" };
  }

  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { groupId, connectionId },
    })
  );

  return { statusCode: 200, body: "Disconnected" };
};
