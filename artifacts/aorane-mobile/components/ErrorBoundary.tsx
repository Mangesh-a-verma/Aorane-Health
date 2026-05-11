import React, { Component, ComponentType, PropsWithChildren } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export type ErrorFallbackProps = { error: Error; resetError: () => void };

function DefaultFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <View style={ef.wrap}>
      <Text style={ef.title}>Something went wrong</Text>
      <Text style={ef.msg}>{error?.message || "An unexpected error occurred."}</Text>
      <TouchableOpacity style={ef.btn} onPress={resetError}>
        <Text style={ef.btnText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

const ef = StyleSheet.create({
  wrap:    { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#FFF8F3" },
  title:   { fontSize: 18, fontWeight: "700", color: "#E8622A", marginBottom: 10 },
  msg:     { fontSize: 13, color: "#6B7280", textAlign: "center", marginBottom: 20, lineHeight: 20 },
  btn:     { backgroundColor: "#E8622A", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  btnText: { color: "#FFF", fontSize: 14, fontWeight: "600" },
});

export type ErrorBoundaryProps = PropsWithChildren<{
  FallbackComponent?: ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, stackTrace: string) => void;
}>;

type ErrorBoundaryState = { error: Error | null };

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static defaultProps: { FallbackComponent: ComponentType<ErrorFallbackProps> } = {
    FallbackComponent: DefaultFallback,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }): void {
    if (typeof this.props.onError === "function") {
      this.props.onError(error, info.componentStack);
    }
  }

  resetError = (): void => { this.setState({ error: null }); };

  render() {
    const { FallbackComponent = DefaultFallback } = this.props;
    return this.state.error ? (
      <FallbackComponent error={this.state.error} resetError={this.resetError} />
    ) : (
      this.props.children
    );
  }
}
