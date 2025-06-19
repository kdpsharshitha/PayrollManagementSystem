// import React from 'react';
// import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
// import { useRouter } from 'expo-router';

// export default function Home() {
//   const router = useRouter();

//   return (
//     <View style={styles.container}>
//       <StatusBar barStyle="light-content" backgroundColor='#22186F' />

//       <Text style={styles.title}>Payroll Management System</Text>

//       <TouchableOpacity style={styles.button} onPress={() => router.push('/login')}>
//         <Text style={styles.buttonText}>Get Started</Text>
//       </TouchableOpacity>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#22186F', 
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingHorizontal: 24,
//   },
//   title: {
//     fontSize: 30,
//     fontWeight: '700',
//     color: 'white', 
//     marginBottom: 50,
//     textAlign: 'center',
//     letterSpacing: 1.1,
//     lineHeight: 40,
//   },
//   button: {
//     backgroundColor: '#2563EB', // Professional blue
//     paddingVertical: 14,
//     paddingHorizontal: 48,
//     borderRadius: 32,
//     shadowColor: '#1E3A8A',
//     shadowOffset: { width: 0, height: 6 },
//     shadowOpacity: 0.3,
//     shadowRadius: 8,
//     elevation: 6,
//   },
//   buttonText: {
//     fontSize: 18,
//     fontWeight: '600',
//     color: 'white', 
//     letterSpacing: 0.8,
//   },
// });





import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground, StatusBar, Platform, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';

export default function Home() {
  const router = useRouter();

  const bgImage = Platform.OS === 'web'
  ? require('../../assets/images/bg3.avif')
  : require('../../assets/images/bg2.png');

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#00000040" />
      
      <ImageBackground
        source={bgImage}
        style={styles.background}
        resizeMode="cover"
      >
        <View style={styles.overlay} />
        <View style={styles.content}>
          <Text style={styles.title}>Payroll Management System</Text>

          <TouchableOpacity style={styles.button} onPress={() => router.push('/login')}>
            <Text style={styles.buttonText}>Get Started</Text>
          </TouchableOpacity>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    height: '100%',
    width: '100%',
  },
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(34, 24, 111, 0.6)',
  }, 
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 1,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: 'white',
    textAlign: 'center',
    marginBottom: 40,
    letterSpacing: 1.2,
    lineHeight: 44,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  button: {
    backgroundColor: '#2563EB',
    //backgroundColor: '#22186F',
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.3s ease',
      },
    }),
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    letterSpacing: 0.8,
  },
});
