import React from 'react';
import { Text, StyleSheet, TextProps } from 'react-native';

interface TypographyProps extends TextProps {
  variant?: 'h1' | 'h2' | 'body' | 'caption';
}

export default function Typography({ 
  variant = 'body',
  style,
  children,
  ...props 
}: TypographyProps) {
  return (
    <Text 
      style={[
        styles.base,
        styles[variant],
        style
      ]} 
      {...props}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    color: '#333',
  },
  h1: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  h2: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },
  body: {
    fontSize: 16,
  },
  caption: {
    fontSize: 14,
    color: '#666',
  },
});
