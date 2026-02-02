import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems:"center",
    backgroundColor:"white"
  },
  imageWrapper: {
    width: 300,
    height: 300,
    backgroundColor: "#E9FBE8", // açık yeşil
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#4CAF50",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },

  circle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },

  imageStyle: {
    width: 120,
    height: 120,
  },

  textViewStyle: {
    alignItems: "center",
    marginTop: 30,
  },
  textStyle: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
  },
  buttonViewStyle: {
    alignItems: "center",
    marginTop: 50,
  },
  buttonStyle: {
    width: 150,
    height: 50,
    backgroundColor: "#4CAF50",
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
});
export default styles;
