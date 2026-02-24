import React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
};

export default class AppErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || "Unexpected application error",
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("AppErrorBoundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, fontFamily: "sans-serif" }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Application Error</h1>
          <p style={{ marginBottom: 16 }}>
            A runtime error occurred while rendering this page.
          </p>
          <pre
            style={{
              background: "#f4f4f5",
              border: "1px solid #e4e4e7",
              borderRadius: 6,
              padding: 12,
              whiteSpace: "pre-wrap",
            }}
          >
            {this.state.message}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}
