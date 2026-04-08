import webpush from 'web-push';

if (
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
  process.env.VAPID_PRIVATE_KEY &&
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY !== 'YOUR_VAPID_PUBLIC_KEY_HERE'
) {
  webpush.setVapidDetails(
    'mailto:' + (process.env.VAPID_EMAIL || 'temple@example.com'),
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export async function sendPushToSubscription(subscription, payload) {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload)
    );
    return { success: true };
  } catch (err) {
    if (err.statusCode === 410) return { success: false, expired: true };
    return { success: false, error: err.message };
  }
}

export async function broadcastPush(subscriptions, payload) {
  const results = await Promise.allSettled(
    subscriptions.map((sub) => sendPushToSubscription(sub, payload))
  );
  return results.map((r, i) => ({
    endpoint: subscriptions[i].endpoint,
    ...(r.status === 'fulfilled' ? r.value : { success: false, error: r.reason }),
  }));
}
