import React from 'react';
import { TouchableOpacity, Text, StyleSheet, TouchableOpacityProps, ActivityIndicator } from 'react-native';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'link' | 'secondary';
  textStyle?: object;
  loading?: boolean;
}

export default function Button({ 
  title, 
  variant = 'primary',
  style,
  textStyle,
  loading,
  ...props 
}: ButtonProps) {
  return (
    <TouchableOpacity 
      style={[
        styles.button,
        variant === 'link' && styles.linkButton,
        variant === 'secondary' && { backgroundColor: '#fff' },
        style,
        loading && styles.loading
      ]} 
      disabled={loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'link' ? '#007AFF' : '#fff'} />
      ) : (
        <Text style={[
          styles.text,
          variant === 'link' && styles.linkText,
          textStyle
        ]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  linkButton: {
    backgroundColor: 'transparent',
    padding: 0,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkText: {
    color: '#007AFF',
    fontSize: 14,
  },
  loading: {
    opacity: 0.5,
    pointerEvents: 'none'
  }
});
