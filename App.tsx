import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInUp,
  FadeOut,
  FlipInEasyX,
  LayoutAnimationConfig,
  LinearTransition,
  SlideInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Color, type Commitment, type Guess } from "./src/types";
import {
  getClue,
  getCommitment,
  verifyClue,
  verifyCommitment,
} from "./src/api";
import { Keyboard } from "./src/Keyboard";
import { ResultView } from "./src/ResultView";
import { validGuesses } from "./src/words";

function Row({ word, colors }: { word: string; colors: Color[] }) {
  return (
    <View style={styles.row}>
      {word.split("").map((char, i) => (
        <Animated.View
          key={i}
          entering={FlipInEasyX.delay(100 * i).springify()}
        >
          <Text style={[styles.cell, { backgroundColor: colors[i] }]}>
            {char}
          </Text>
        </Animated.View>
      ))}
    </View>
  );
}

function InputRow({
  text,
  isLoading,
  isInvalid,
  isInvalidGuess,
}: {
  text: string;
  isLoading: boolean;
  isInvalid: boolean;
  isInvalidGuess: boolean;
}) {
  const sv = useSharedValue(1);
  const sv2 = useSharedValue<string>(Color.GREY);

  useEffect(() => {
    sv.value = isLoading
      ? withRepeat(withTiming(0.5, { duration: 600 }), -1, true)
      : 1;
    if (isInvalid) {
      sv.value = 1;
    }
    sv2.value = withTiming(isInvalidGuess ? "#FF2222" : Color.GREY, {
      duration: isInvalidGuess ? 1000 : 500,
    });
  }, [isLoading, isInvalid, isInvalidGuess]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: sv.value,
    };
  });

  const cellStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: sv2.value,
    };
  });

  let trimmedText = text.slice(0, 5);
  while (trimmedText.length < 5) {
    trimmedText += " ";
  }

  return (
    <Animated.View
      key={"input"}
      layout={LinearTransition}
      entering={FadeInUp}
      style={[styles.row, animatedStyle]}
    >
      {trimmedText.split("").map((char, i) => (
        <Animated.View
          entering={FadeIn}
          exiting={FadeOut.delay(100 * i)}
          key={i}
          style={[
            styles.cell,
            cellStyle,
            isInvalid && { backgroundColor: "red" },
          ]}
        >
          <LayoutAnimationConfig skipExiting>
            <Animated.Text
              key={i + char}
              entering={FadeInUp}
              exiting={FadeOut}
              style={styles.textInput}
            >
              {char}
            </Animated.Text>
          </LayoutAnimationConfig>
        </Animated.View>
      ))}
    </Animated.View>
  );
}

export default function App() {
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [text, setText] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const greenLetters = useRef(new Set<string>());
  const yellowLetters = useRef(new Set<string>());
  const darkGreyLetters = useRef(new Set<string>());
  const [commitment, setCommitment] = useState<Commitment | null>(null);
  const [isInvalidProof, setIsInvalidProof] = useState<boolean>(false);
  const [isMembershipVerified, setIsMembershipVerified] =
    useState<boolean>(false);
  const [isInvalidGuess, setIsInvalidGuess] = useState<boolean>(false);
  const [isCommitmentOld, setIsCommitmentOld] = useState<boolean>(false);

  useEffect(() => {
    getCommitment().then(setCommitment);
  }, []);

  useEffect(() => {
    if (commitment) {
      verifyCommitment(commitment).then((valid) => {
        if (!valid) {
          setIsInvalidProof(true);
        } else {
          setIsMembershipVerified(true);
        }
      });
    }
  }, [commitment]);

  const updateColors = (guess: Guess) => {
    for (let i = 0; i < guess.colors.length; i++) {
      if (guess.colors[i] === Color.GREEN) {
        greenLetters.current.add(guess.word[i]);
      } else if (guess.colors[i] === Color.YELLOW) {
        yellowLetters.current.add(guess.word[i]);
      } else {
        darkGreyLetters.current.add(guess.word[i]);
      }
    }
  };

  const finished =
    guesses.length === 6 ||
    (guesses.length > 0 &&
      guesses[guesses.length - 1].colors.every(
        (color) => color === Color.GREEN
      ));

  const updateText = (char: string) => {
    if (isLoading) return;
    setText((prev) => (prev.length < 5 ? prev + char : prev));
  };

  const onSubmit = () => {
    if (isInvalidProof) {
      return;
    }
    if (text.length === 5 && commitment !== null) {
      if (!validGuesses.has(text.toLowerCase())) {
        setIsInvalidGuess(true);
        return;
      }
      setIsLoading(true);
      getClue(text, commitment.word_id).then((response) => {
        if (response.type === "error") {
          if (response.error === "word does not exist") {
            setIsInvalidGuess(true);
          } else {
            setIsCommitmentOld(true);
          }
          setIsLoading(false);
          return;
        }
        const clue = response.value;

        verifyClue(text, clue, commitment.commitment).then((valid) => {
          if (!valid) {
            setIsInvalidProof(true);
            return;
          }
          setGuesses([...guesses, { word: text, colors: clue.colors }]);
          updateColors({ word: text, colors: clue.colors });
          setText("");
          setIsLoading(false);
        });
      });
    }
  };

  const onBack = () => {
    if (isLoading || isInvalidProof) return;
    setText((prev) => prev.slice(0, prev.length - 1));
    setIsInvalidGuess(false);
  };

  const cmt = commitment?.commitment ?? "";

  return (
    <View style={styles.container}>
      <View style={{ flexDirection: "row", flexShrink: 1, marginBottom: 10 }}>
        <Text style={styles.hash}>
          Current hash: {cmt.slice(0, Math.floor(cmt.length / 2))}
          {"\n"}
          {cmt.slice(Math.floor(cmt.length / 2), cmt.length)}
          {isMembershipVerified ? " ✅" : " ⏱️"}
        </Text>
      </View>
      {isCommitmentOld && (
        <Animated.View entering={FadeIn} style={{ marginBottom: 10 }}>
          <Text style={styles.errorText}>{"The commitment is old."}</Text>
          <Text style={styles.errorText}>{"There is a new word."}</Text>
          <Text style={styles.errorText}>{"Please refresh the page."}</Text>
        </Animated.View>
      )}
      {isInvalidProof && (
        <Animated.Text
          entering={FadeIn}
          style={[styles.errorText, { marginBottom: 10 }]}
        >
          {"The server is lying to you :("}
        </Animated.Text>
      )}
      {finished && (
        <ResultView
          won={guesses[guesses.length - 1].colors.every(
            (color) => color === Color.GREEN
          )}
        />
      )}
      <View>
        {guesses.map((guess, i) => (
          <Row key={i} word={guess.word} colors={guess.colors} />
        ))}
        {!finished && (
          <InputRow
            key={guesses.length}
            text={text}
            isLoading={isLoading}
            isInvalid={isInvalidProof}
            isInvalidGuess={isInvalidGuess}
          />
        )}
      </View>
      <Keyboard
        isLoading={
          commitment === null || isInvalidProof || finished || isLoading
        }
        greenLetters={greenLetters.current}
        yellowLetters={yellowLetters.current}
        darkGreyLetters={darkGreyLetters.current}
        onPress={updateText}
        onSubmit={onSubmit}
        onBack={onBack}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#111111",
    justifyContent: "flex-start",
    padding: 20,
  },
  row: {
    flexDirection: "row",
  },
  cell: {
    margin: 5,
    fontSize: 50,
    fontWeight: "500",
    width: 60,
    height: 60,
    textAlign: "center",
    textAlignVertical: "center",
    borderRadius: 5,
    backgroundColor: Color.GREY,
  },
  textInput: {
    fontSize: 50,
    fontWeight: "500",
    width: 60,
    height: 60,
    textAlign: "center",
    textAlignVertical: "center",
  },
  text: {
    color: "white",
    fontSize: 50,
  },
  hash: {
    color: "white",
    fontSize: 10,
    flexShrink: 1,
    textAlign: "center",
  },
  errorText: {
    color: "#FF2222",
    fontSize: 30,
    alignSelf: "center",
  },
});
