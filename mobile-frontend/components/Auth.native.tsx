import {
  GoogleSignin,
  GoogleSigninButton,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export default function GoogleAuth() {
  GoogleSignin.configure({
    webClientId:
      "356723957418-hrj0gadjjnbqfkit127100ctko3t0dra.apps.googleusercontent.com",
  });

  const { googleLogin } = useAuth();

  return (
    <GoogleSigninButton
      size={GoogleSigninButton.Size.Wide}
      color={GoogleSigninButton.Color.Dark}
      onPress={async () => {
        try {
          await GoogleSignin.hasPlayServices();
          const userInfo = await GoogleSignin.signIn();
          if (userInfo.data?.idToken) {
            googleLogin(userInfo.data?.idToken);
          } else {
            throw new Error("no ID token present!");
          }
        } catch (error: any) {
          console.error(error);
          if (error.code === statusCodes.SIGN_IN_CANCELLED) {
            // user cancelled the login flow
          } else if (error.code === statusCodes.IN_PROGRESS) {
            // operation (e.g. sign in) is in progress already
          } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
            // play services not available or outdated
          } else {
            // some other error happened
          }
        }
      }}
    />
  );
}
