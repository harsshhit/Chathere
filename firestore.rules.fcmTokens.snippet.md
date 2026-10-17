```firestore.rules
match /fcmTokens/{uid} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```
