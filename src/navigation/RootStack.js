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
  Recipes,
  Settings,
  ClientCalendar,
  ClientSettings,
  ClientRecipes,
} from "../pages";
import { DietitianTabBar } from "../components";
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
      options: { headerShown: false },
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
    DietitianTabBar: {
      screen: DietitianTabBar,
      options: { headerShown: false },
    },
    Recipes: {
      screen: Recipes,
      options: { headerShown: false },
    },
    Settings: {
      screen: Settings,
      options: { headerShown: false },
    },
    ClientCalendar: {
      screen: ClientCalendar,
      options: { headerShown: false },
    },
    ClientSettings: {
      screen: ClientSettings,
      options: { headerShown: false },
    },
    ClientRecipes: {
      screen: ClientRecipes,
      options: { headerShown: false },
    },
  },
});

export const Navigation = createStaticNavigation(RootStack);
