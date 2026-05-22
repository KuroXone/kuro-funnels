function Login() {
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        gap: "20px",
        background: "#0f172a",
      }}
    >
      <h1 style={{ color: "white" }}>KURO FUNNELS</h1>

      <input
        placeholder="Email"
        style={{
          padding: "12px",
          width: "250px",
        }}
      />

      <input
        type="password"
        placeholder="Password"
        style={{
          padding: "12px",
          width: "250px",
        }}
      />

      <button
        style={{
          padding: "12px 30px",
          cursor: "pointer",
        }}
      >
        Login
      </button>
    </div>
  );
}

export default Login;
