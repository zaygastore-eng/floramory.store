import { useEffect, useState } from "react";

export default function useToast(duration = 3000) {
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
  };

  useEffect(() => {
    if (!toastVisible) return;
    const timer = window.setTimeout(() => setToastVisible(false), duration);
    return () => window.clearTimeout(timer);
  }, [duration, toastVisible, toastMsg]);

  return { toastMsg, toastVisible, showToast };
}
