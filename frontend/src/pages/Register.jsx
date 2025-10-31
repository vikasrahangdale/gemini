// src/pages/Register.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";


export default function Register() {
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const navigate = useNavigate();
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  setError("");
  setSuccess("");

  if (!form.username || !form.email || !form.password) {
    setError("All fields are required!");
    return;
  }

  try {
const res = await fetch(`${API_BASE}/user/register`, {

      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    console.log("🚀 Backend response:", data);

    if (res.ok && data.success) {
      const token = data?.data?.token;
      const user = data?.data?.user;

      if (token) localStorage.setItem("token", token);
      if (user) {
        localStorage.setItem("username", user.username);
        localStorage.setItem("email", user.email);
        console.log("✅ User saved:", user.username, user.email);
      }

      setSuccess("Registration successful! Redirecting...");
      setForm({ username: "", email: "", password: "" });

      setTimeout(() => navigate("/chat"), 1000);
    } else {
      setError(data.message || "Something went wrong!");
    }
  } catch (err) {
    console.error("❌ Server Error:", err);
    setError("Server error. Please try again later.");
  }
};


  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-xl">
        <h2 className="text-2xl font-bold mb-6 text-center"> Create New Account...</h2>

        {error && <p className="text-red-500 mb-4">{error}</p>}
        {success && <p className="text-green-500 mb-4">{success}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1 font-medium">Username</label>
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter username"
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter email"
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">Password</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter password"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition"
          >
            Register
          </button>
        </form>

        <p className="mt-4 text-center text-gray-600">
          You already have an account?{" "}
          <a href="/" className="text-blue-500 hover:underline">
            Login
          </a>
        </p>
      </div>
    </div>
  );
}
