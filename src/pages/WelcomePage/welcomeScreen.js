import { Text, View, Image, TouchableOpacity } from "react-native";
import { welcomeIcon } from "../../assets/icons";
import styles from "./styles";
import { useState, React } from "react";
import { useNavigation } from "@react-navigation/native";

const WelcomeScreen = () => {
  const [page, SetPage] = useState("SignUp");
  const navigation = useNavigation();
  return (
    <View style={styles.container}>
      <View style={styles.imageWrapper}>
        <View style={styles.circle}>
          <Image style={styles.imageStyle} source={welcomeIcon} />
        </View>
      </View>

      <View style={styles.textViewStyle}>
        <Text style={styles.textStyle}>DİYET UYGULAMASINA HOŞGELDİNİZ</Text>
      </View>

      <View style={styles.buttonViewStyle}>
        <TouchableOpacity
          style={styles.buttonStyle}
          onPress={() => navigation.navigate(page)}
        >
          <Text style={styles.buttonText}>BAŞLA</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default WelcomeScreen;
