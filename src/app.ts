import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, DeleteCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME || "ChatConnections";

export const handler = async (event) => {
  const { routeKey, connectionId, domainName, stage } = event.requestContext;

  try {
    if (routeKey === "$connect") {
      const groupId = event.queryStringParameters?.groupId;
      if (!groupId) return { statusCode: 400, body: "Missing groupId" };

      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: { groupId, connectionId, connectedAt: new Date().toISOString() }
      }));

      return { statusCode: 200, body: "Connected" };
    }

    if (routeKey === "$disconnect") {
      const groupId = event.queryStringParameters?.groupId;
      if (!groupId) return { statusCode: 200, body: "Disconnected" };

      await docClient.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { groupId, connectionId }
      }));

      return { statusCode: 200, body: "Disconnected" };
    }

    if (routeKey === "sendMessage") {
      const { groupId, message } = JSON.parse(event.body || "{}");
      if (!groupId || !message) return { statusCode: 400, body: "Missing data" };

      const { Items } = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "groupId = :g",
        ExpressionAttributeValues: { ":g": groupId }
      }));

      if (!Items || Items.length === 0) {
        return { statusCode: 200, body: "No users online" };
      }

      const apiClient = new ApiGatewayManagementApiClient({ 
        endpoint: `https://${domainName}/${stage}` 
      });

      const messageData = JSON.stringify({
        message,
        sender: connectionId,
        timestamp: new Date().toISOString()
      });

      await Promise.all(Items.map(async (user) => {
        try {
          await apiClient.send(new PostToConnectionCommand({
            ConnectionId: user.connectionId,
            Data: Buffer.from(messageData)
          }));
        } catch (error) {
          if (error.statusCode === 410) {
            await docClient.send(new DeleteCommand({
              TableName: TABLE_NAME,
              Key: { groupId, connectionId: user.connectionId }
            }));
          }
        }
      }));

      return { statusCode: 200, body: "Sent" };
    }

    return { statusCode: 400, body: "Unknown action" };

  } catch (error) {
    console.error("Error:", error);
    return { statusCode: 500, body: error.message };
  }
};