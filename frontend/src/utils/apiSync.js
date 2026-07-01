export async function safePost(url, data) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    return res.json();
  } catch (err) {
    console.warn("Offline → queued for retry");
    return { offline: true };
  }
}
