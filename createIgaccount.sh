curl -X POST "https://moca-production.up.railway.app/api/instagram/accounts" \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "17841467023627361",
    "accountName": "Fidelidapp",
    "accessToken": "IGAAesZCrSZCsRxBZAE0wS01Fd0VHZAGxzaVRLb0p5Q0FudVpLaW15ejFHX3dLakN6WV9CS3NGSENYNXhZAYzRxaG4xbG55RXZAIWUxhdXpWcEY3RjlSZATRYSV9CZAUVrY3FmS1I0U1ZApd0RoNFEtN1NRQk9nQlBxRE9MVFJPeVJkVDFrNAZDZD",
    "refreshToken": "YOUR_REFRESH_TOKEN_OPTIONAL",
    "rateLimits": {
      "messagesPerSecond": 1,
      "userCooldown": 7
    },
    "settings": {
      "autoRespond": true,
      "aiEnabled": true,
      "fallbackRules": [
        "Thank you for your message! We will get back to you soon.",
        "Thanks for reaching out! Our team will respond shortly."
      ]
    }
  }'