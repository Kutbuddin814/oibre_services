router.get("/my-requests", authMiddleware, async (req, res) => {
  console.log("🔑 Provider from token:", req.providerId);

  const requests = await ServiceRequest.find({
    providerId: req.providerId
  });

  console.log("📦 Requests found:", requests.length);

  res.json(requests);
});
