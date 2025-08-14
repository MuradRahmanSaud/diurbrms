import React, { useState, useEffect, useMemo } from 'react';
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import Modal from '../Modal';
import { ConflictInfoForModal, AiResolutionSuggestion, RoomEntry, DefaultTimeSlot, ProgramEntry, EnrollmentEntry, DailyRoutineData } from '../../types';
import { formatDefaultSlotToString } from '../../App';

interface ConflictResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflictInfo: ConflictInfoForModal;
  onApplyResolution: (resolution: AiResolutionSuggestion) => void;
  allRooms: RoomEntry[];
  systemDefaultSlots: DefaultTimeSlot[];
  allPrograms: ProgramEntry[];
  coursesData: EnrollmentEntry[];
  fullRoutineForDay: DailyRoutineData;
  semesterId: string | null;
}

const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  isOpen,
  onClose,
  conflictInfo,
  onApplyResolution,
  allRooms,
  systemDefaultSlots,
  allPrograms,
  coursesData,
  fullRoutineForDay,
  semesterId,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AiResolutionSuggestion[]>([]);
  
  const constructPrompt = () => {
    // Find student counts for the conflicting classes
    const assignmentsWithStudentCount = conflictInfo.assignments.map(a => {
        const course = coursesData.find(c => 
            c.pId === a.classInfo.pId &&
            c.courseCode === a.classInfo.courseCode &&
            c.section === a.classInfo.section &&
            c.semester === semesterId
        );
        return {
            ...a,
            studentCount: course?.studentCount ?? 0,
        };
    });

    // Find full schedule for the conflicting teacher
    let teacherScheduleString = "N/A";
    if (conflictInfo.conflictType === 'teacher') {
        const teacherName = conflictInfo.identifier;
        const schedule: { slot: string, course: string, room: string }[] = [];
        Object.entries(fullRoutineForDay).forEach(([roomNumber, slots]) => {
            Object.entries(slots).forEach(([slotString, classInfo]) => {
                if (classInfo && classInfo.teacher === teacherName) {
                    schedule.push({ slot: slotString, course: `${classInfo.courseCode} (${classInfo.section})`, room: roomNumber });
                }
            });
        });
        teacherScheduleString = schedule.map(s => `- ${s.slot}: ${s.course} in ${s.room}`).join('\n');
    }

    return `
You are an expert university class schedule conflict resolution assistant.
Your task is to provide actionable solutions to resolve the conflict.

**Context:**
- Current Day: ${conflictInfo.day}
- Semester: ${semesterId}

**Conflict Details:**
- Type: A "${conflictInfo.conflictType}" conflict has occurred.
- Identifier: ${conflictInfo.identifier} (${conflictInfo.conflictType === 'teacher' ? 'Teacher Name' : 'Section ID'})
- Time Slot: ${conflictInfo.slotString}
- Conflicting Classes:
${assignmentsWithStudentCount.map(a => `- ${a.classInfo.courseCode} (${a.classInfo.section}) in Room ${a.room.roomNumber} (Capacity: ${a.room.capacity}, Students: ${a.studentCount})`).join('\n')}

**Full Routine for Today (${conflictInfo.day}):**
${JSON.stringify(fullRoutineForDay, null, 2)}

**Full Schedule for Teacher "${conflictInfo.identifier}" Today:**
${teacherScheduleString}

**Available Rooms and their capacities for this semester:**
${JSON.stringify(allRooms.map(r => ({ roomNumber: r.roomNumber, capacity: r.capacity })), null, 2)}

**Instructions:**
1. Analyze the conflict. Your goal is to move one of the conflicting classes to a new, free slot.
2. Find alternative free slots for one of the conflicting classes. A slot is considered free in a room if that room does not appear in the daily routine JSON at that slot time.
3. A valid "MOVE" suggestion requires the target room to have sufficient capacity for the class's student count.
4. The teacher of the class being moved must be free at the new time slot. Analyze the teacher's schedule to ensure they are not booked in another class at the suggested new time.
5. Provide up to 3 valid solutions. Prioritize solutions on the same day if possible.
6. For each solution, provide a clear, human-readable description.

**Output Format:**
Return a JSON array of objects. Each object must have the following structure:
{
  "action": "MOVE",
  "description": "A human-readable description of the move. Example: 'Move CSE101 (Sec A) to free Room AB4-404 at the same time slot.'",
  "source": { "day": "${conflictInfo.day}", "roomNumber": "[source_room_number]", "slotString": "${conflictInfo.slotString}" },
  "target": { "day": "${conflictInfo.day}", "roomNumber": "[target_room_number]", "slotString": "[target_slot_string]" }
}
Only suggest MOVE actions. If no valid solutions can be found, return an empty array.
`;
  };

  useEffect(() => {
    if (isOpen) {
      const generateSuggestions = async () => {
        setIsLoading(true);
        setError(null);
        setSuggestions([]);

        if (!process.env.API_KEY) {
          setError("API Key is not configured.");
          setIsLoading(false);
          return;
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = constructPrompt();

        try {
          const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
          });
          
          let jsonStr = response.text.trim();
          const parsedData = JSON.parse(jsonStr);

          if (Array.isArray(parsedData)) {
            setSuggestions(parsedData as AiResolutionSuggestion[]);
          } else {
            throw new Error("Invalid format received from AI.");
          }
        } catch (e: any) {
          console.error("Error generating suggestions:", e);
          setError(`Failed to get suggestions: ${e.message || 'Unknown error'}.`);
        } finally {
          setIsLoading(false);
        }
      };

      generateSuggestions();
    }
  }, [isOpen, conflictInfo]);

  const footer = (
      <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded-md hover:bg-gray-300">
          Close
      </button>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Resolve Scheduling Conflict" footerContent={footer} maxWidthClass="max-w-4xl">
      <div className="space-y-4">
        {/* Conflict Description */}
        <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
          <h3 className="font-bold text-red-800">Conflict Detected</h3>
          <p className="text-sm text-red-700 mt-1">
            The {conflictInfo.conflictType} <span className="font-semibold">{conflictInfo.identifier}</span> is scheduled in multiple rooms during the <span className="font-semibold">{conflictInfo.slotString}</span> slot on {conflictInfo.day}.
          </p>
          <ul className="list-disc list-inside text-sm text-red-700 mt-2 space-y-1">
            {conflictInfo.assignments.map(a => (
              <li key={a.room.id}>
                <span className="font-semibold">{a.classInfo.courseCode} ({a.classInfo.section})</span> in Room {a.room.roomNumber}
              </li>
            ))}
          </ul>
        </div>

        {/* AI Suggestions */}
        <div>
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <span className="text-yellow-500">✨</span> AI Suggestions
          </h3>
          <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200 min-h-[150px] flex flex-col">
            {isLoading ? (
              <div className="flex-grow flex items-center justify-center space-x-2 text-gray-500">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
                <span>Analyzing routine for solutions...</span>
              </div>
            ) : error ? (
              <div className="flex-grow flex items-center justify-center text-red-600">
                Error: {error}
              </div>
            ) : suggestions.length > 0 ? (
              <div className="space-y-2">
                {suggestions.map((suggestion, index) => (
                  <div key={index} className="p-2 bg-white rounded-md border border-gray-200 flex items-center justify-between gap-4 hover:bg-teal-50 transition-colors">
                    <p className="text-sm text-gray-700 flex-grow">
                      <span className="font-semibold text-teal-700 mr-1">{suggestion.action}:</span> {suggestion.description}
                    </p>
                    <button
                      onClick={() => onApplyResolution(suggestion)}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-md shadow-sm flex-shrink-0"
                    >
                      Apply Solution
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-grow flex items-center justify-center text-center text-gray-500 italic">
                No automatic resolutions could be found. Manual adjustment may be required.
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ConflictResolutionModal;
