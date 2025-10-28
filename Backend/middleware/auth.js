const jwt = require("jsonwebtoken");
const User = require("../models/User");

const auth = async (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "No token provided or invalid header format",
      });
    }

    const token = authHeader.split(" ")[1];
    // console.log("Token extracted:", token);

    if (!token || token === "null" || token === "undefined") {
      return res.status(401).json({
        success: false,
        error: "Token missing or invalid",
      });
    }

    // 🔍 Step 3:Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (verifyError) {
      return res.status(401).json({
        success: false,
        error: "Token verification failed or expired",
      });
    }

    // 🔍 Step 4: Find user in DB
    const user = await User.findById(decoded.userId).select("-password");
    // console.log("User found:", user ? user.email : "No user found");

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "User not found for this token",
      });
    }

    // 🔍Step 5: Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.log("Middleware error:", error.message);
    res.status(500).json({
      success: false,
      error: "Internal server error in authentication",
    });
  }
};

// 🧾 Token generator
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

module.exports = { auth, generateToken };
