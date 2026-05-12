import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>MyIPOApp</Text>
      <Text style={styles.subtitle}>
        If you see this, edits from App.js are on your device.
      </Text>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1b2e',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#e94560',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#eaeaea',
    textAlign: 'center',
    lineHeight: 24,
  },
});
