import { APIGatewayProxyResultV2 } from "aws-lambda";
import {
  QueryCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";

import { docClient } from "../config/dynamo";
import { createApiGatewayClient } from "../utils/apiGateway";

const TABLE_NAME = process.env.TABLE_NAME || "ChatConnections";

export const sendMessage = async (
  event: any
): Promise<APIGatewayProxyResultV2> => {
  const { connectionId, domainName, stage } = event.requestContext;
  const { groupId, message } = JSON.parse(event.body || "{}");

  if (!groupId || !message) {
    return { statusCode: 400, body: "Missing data" };
  }

  const { Items } = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "groupId = :g",
      ExpressionAttributeValues: {
        ":g": groupId,
      },
    })
  );

  if (!Items || Items.length === 0) {
    return { statusCode: 200, body: "No users online" };
  }

  const apiClient = createApiGatewayClient(domainName, stage);

  const payload = JSON.stringify({
    message,
    sender: connectionId,
    timestamp: new Date().toISOString(),
  });

  await Promise.all(
    Items.map(async (user: any) => {
      try {
        await apiClient.send(
          new PostToConnectionCommand({
            ConnectionId: user.connectionId,
            Data: Buffer.from(payload),
          })
        );
      } catch (error: any) {
        if (error.statusCode === 410) {
          await docClient.send(
            new DeleteCommand({
              TableName: TABLE_NAME,
              Key: {
                groupId,
                connectionId: user.connectionId,
              },
            })
          );
        }
      }
    })
  );

  return { statusCode: 200, body: "Sent" };
};
