import React, { createContext, useContext, useEffect, useState } from "react";
import { db, doc, onSnapshot, updateDoc } from "./firebase";
import { useSearchParams } from "react-router-dom";

const UserContext = createContext(null);

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};

export const UserProvider = ({ children }) => {
  const [searchParams] = useSearchParams();
  const uid = searchParams.get("start");

  const [userData, setUserData] = useState(null);

  useEffect(() => {
    if (!uid) {
      setUserData(null);
      return;
    }

    const userRef = doc(db, "users", uid);

    const unsubscribe = onSnapshot(userRef, async (docSnap) => {
      if (!docSnap.exists()) {
        setUserData(null);
        return;
      }

      const data = docSnap.data();

      if (!Object.prototype.hasOwnProperty.call(data, "SecretRecipes")) {
        try {
          await updateDoc(userRef, { SecretRecipes: 0 });
          console.log("SecretRecipes поле добавлено");
          // Обновим локально, не дожидаясь следующего snapshot
          setUserData({ uid, ...data, SecretRecipes: 0 });
          return;
        } catch (error) {
          console.error("Ошибка при добавлении SecretRecipes:", error);
        }
      }

      setUserData({ uid, ...data });
    });

    return () => unsubscribe();
  }, [uid]);

  return (
    <UserContext.Provider value={{ userData }}>{children}</UserContext.Provider>
  );
};
