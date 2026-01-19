import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { connectUser, disconnectUser } from "./services/connection.service";
import { sendMessage } from "./services/message.service";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const { routeKey } = event.requestContext;

  try {
    switch (routeKey) {
      case "$connect":
        return await connectUser(event);

      case "$disconnect":
        return await disconnectUser(event);

      case "sendMessage":
        return await sendMessage(event);

      default:
        return { statusCode: 400, body: "Unknown action" };
    }
  } catch (error: any) {
    console.error("Error:", error);
    return { statusCode: 500, body: error.message };
  }
};
