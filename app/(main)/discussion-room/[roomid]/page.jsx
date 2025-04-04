"use client";

import { api } from "@/convex/_generated/api";
import { CoachingExpert, coachingOptions } from "@/services/Options";
import { UserButton } from "@stackframe/stack";
import { useQuery } from "convex/react";
import Image from "next/image";
import { useParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2Icon } from "lucide-react";
import { AIModel } from "@/services/GlobalServices";
import ChatBox from "./_components/ChatBox";

function DiscussionRoom() {
  const { roomid } = useParams();
  const DiscussionRoomData = useQuery(api.DiscussionRoom.GetDiscussionRoom, { id: roomid });
  const [expert, setExpert] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [enableMic, setEnableMic] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [conversation, setConversation] = useState([
    { role: "assistant", content: "Hi" },
    { role: "user", content: "Hello" },
  ]);
  const [loading, setLoading] = useState(false);
  const [manualStop, setManualStop] = useState(false);

  useEffect(() => {
    if (DiscussionRoomData) {
      const Expert = CoachingExpert.find(
        (item) => item.name === DiscussionRoomData.expertName
      );
      console.log("Expert:", Expert);
      setExpert(Expert);
    }
  }, [DiscussionRoomData]);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("Your browser does not support the Speech Recognition API");
    }
  }, []);

  // Effect that triggers an AI call when the last conversation message is from the user.
  useEffect(() => {
    async function fetchAIResponse() {
      if (!DiscussionRoomData) return;
      if (conversation.length === 0) return;
      if (conversation[conversation.length - 1].role === "user") {
        // Capture the last two messages for context.
        const lastTwoMsg = conversation.slice(-2);
        console.log("User response received:", lastTwoMsg);
        try {
          const aiResponse = await AIModel(
            DiscussionRoomData.topic,
            DiscussionRoomData.coachingOptions,
            lastTwoMsg
          );
          console.log("AI Response:", aiResponse);
          setConversation((prev) => [
            ...prev,
            {
              role: "assistant",
              content: aiResponse.choices[0].message.content,
            },
          ]);
        } catch (error) {
          console.error("Error in AI call:", error);
        }
      }
    }
    fetchAIResponse();
  }, [conversation, DiscussionRoomData]);

  const connectToServer = async () => {
    setLoading(true);
    setManualStop(false);
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech Recognition API is not supported in your browser.");
      setLoading(false);
      return;
    }
    const recognitionInstance = new SpeechRecognition();
    recognitionInstance.continuous = true;
    recognitionInstance.interimResults = true;
    recognitionInstance.lang = "en-US";

    recognitionInstance.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptChunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptChunk + " ";
          // Immediately add the final user response to conversation
          setConversation((prev) => [
            ...prev,
            { role: "user", content: transcriptChunk },
          ]);
          console.log("Added user response:", transcriptChunk);
        } else {
          interimTranscript += transcriptChunk;
        }
      }
      setTranscript(finalTranscript + interimTranscript);
    };

    recognitionInstance.onerror = (event) => {
      if (event.error !== "aborted") {
        console.error("Speech recognition error:", event.error);
      }
    };

    recognitionInstance.onend = () => {
      console.log("Speech recognition ended");
      if (!manualStop) {
        recognitionInstance.start();
      } else {
        setEnableMic(false);
        setLoading(false);
      }
    };

    recognitionInstance.start();
    setRecognition(recognitionInstance);
    setEnableMic(true);
    setLoading(false);
  };

  const stopRecognition = () => {
    if (recognition) {
      setManualStop(true);
      recognition.stop();
      setEnableMic(false);
      setLoading(false);
    }
  };

  return (
    <div className="-mt-12">
      <h2 className="text-lg font-bold">
        {DiscussionRoomData?.coachingOptions}
      </h2>
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2">
          <div
            className="h-[60vh] bg-secondary border rounded-4xl
            flex flex-col items-center justify-center relative"
          >
            {expert?.avatar ? (
              <Image
                src={expert.avatar}
                alt="avatar"
                width={200}
                height={200}
                className="h-[80px] w-[80px] object-cover rounded-full animate-pulse"
              />
            ) : (
              <p>Loading expert...</p>
            )}
            <h2 className="text-gray-500">{expert?.name}</h2>
            <div className="p-5 bg-gray-200 px-10 rounded-lg absolute bottom-10 right-10">
              <UserButton />
            </div>
          </div>
          <div className="mt-5 flex items-center justify-center">
            {!enableMic ? (
              <Button onClick={connectToServer} disabled={loading}>
                {loading && <Loader2Icon className="animate-spin" />} Connect
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={stopRecognition}
                disabled={loading}
              >
                {loading && <Loader2Icon className="animate-spin" />} Disconnect
              </Button>
            )}
          </div>
        </div>
        <div>
          <ChatBox conversation={conversation} />
        </div>
      </div>
      <div className="mt-10 text-center">
        <h2 className="text-2xl font-semibold">{transcript}</h2>
      </div>
    </div>
  );
}

export default DiscussionRoom;
