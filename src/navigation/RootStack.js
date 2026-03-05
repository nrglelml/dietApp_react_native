import { createStaticNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createNavigationContainerRef } from "@react-navigation/native";
import {
  WelcomeScreen,
  SignUpScreen,
  LoginScreen,
  VerifyOTP,
  HomeClient,
  HomeDyt,
  UpdatePassword,
  ApprovalScreen,
  CreateProgram,
  ClientDetail,
  DietitianCalendar,
} from "../pages";
export const navigationRef = createNavigationContainerRef();
const RootStack = createNativeStackNavigator({
  screens: {
    Welcome: {
      screen: WelcomeScreen,
      options: { headerShown: false },
    },
    SignUp: {
      screen: SignUpScreen,
      options: { headerShown: false },
    },
    Login: {
      screen: LoginScreen,
      options: { headerShown: false },
    },
    VerifyOTP: {
      screen: VerifyOTP,
      options: { headerShown: false },
    },
    UpdatePassword: {
      screen: UpdatePassword,
      options: { headerShown: false },
    },
    HomeClient: {
      screen: HomeClient,
      options: { headerShown: true },
    },
    HomeDyt: {
      screen: HomeDyt,
      options: { headerShown: false },
    },
    ApprovalScreen: {
      screen: ApprovalScreen,
      options: { headerShown: false },
    },
    CreateProgram: {
      screen: CreateProgram,
      options: { headerShown: false },
    },
    ClientDetail: {
      screen: ClientDetail,
      options: { headerShown: false },
    },
    DietitianCalendar: {
      screen: DietitianCalendar,
      options: { headerShown: false },
    },
  },
});

export const Navigation = createStaticNavigation(RootStack);
