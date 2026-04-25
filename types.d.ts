declare module 'silabajs' {
  const silabaJS: {
    getSilabas: (word: string) => {
      palabra: string;
      longitudPalabra: number;
      numeroSilaba: number;
      silabas: { silaba: string }[];
      tonica: number;
      letraTildada: number | null;
      enconcurso: boolean;
    };
  };
  export default silabaJS;
}

declare module 'an-array-of-spanish-words' {
  const spanishWords: string[];
  export default spanishWords;
}
