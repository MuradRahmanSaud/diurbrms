

import React, { useState, useCallback } from 'react';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { DayOfWeek, TimeSlot, SuggestedClassEntry } from '../types';
import { DAYS_OF_WEEK, FALLBACK_TIME_SLOTS, FALLBACK_ROOM_NUMBERS } from '../data/routineConstants'; // Updated imports

// Helper function to format HH:MM (24-hour) time to hh:mm AM/PM (from DefaultTimeSlotManager)
const formatTimeToAMPM = (time24: string): string => {
  if (!time24) return 'N/A';
  try {
    const [hours, minutes] = time24.split(':');
    let h = parseInt(hours, 10);
    const m = parseInt(minutes, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12; 
    const hStr = h < 10 ? '0' + h : h.toString();
    const mStr = m < 10 ? '0' + m : m.toString();
    return `${hStr}:${mStr} ${ampm}`;
  } catch (e) {
    return 'Invalid Time';
  }
};

const SmartSchedulerView: React.FC = () => {
  const [preferredDays, setPreferredDays] = useState<DayOfWeek[]>([]);
  const [preferredTimeSlots, setPreferredTimeSlots] = useState<TimeSlot[]>([]);
  const [courses, setCourses] = useState<string>('');
  const [faculty, setFaculty] = useState<string>('');
  const [otherConstraints, setOtherConstraints] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedSchedule, setSuggestedSchedule] = useState<SuggestedClassEntry[] | null>(null);

  const handleDayToggle = (day: DayOfWeek) => {
    setPreferredDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleTimeSlotToggle = (slot: TimeSlot) => {
    setPreferredTimeSlots(prev =>
      prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot]
    );
  };

  const constructPrompt = () => {
    return `
You are an expert university class scheduler. Your task is to generate an optimized weekly class schedule based on the following student preferences and available resources.

System-Wide Available Days: ${DAYS_OF_WEEK.join(', ')}
System-Wide Available Time Slots (These are the slots the system generally supports):
${FALLBACK_TIME_SLOTS.map(slot => `- ${slot}`).join('\n')}
System-Wide Available Rooms (These are the rooms the system generally has): ${FALLBACK_ROOM_NUMBERS.join(', ')}

Student Preferences:
- Preferred Days: ${preferredDays.length > 0 ? preferredDays.join(', ') : 'Any of the system-wide available days'}
- Preferred Time Slots: ${preferredTimeSlots.length > 0 ? preferredTimeSlots.join(', ') : 'Any of the system-wide available time slots'}
- Desired Courses (and sections if known, separate by comma): ${courses || 'Not specified'}
- Preferred Faculty (separate by comma): ${faculty || 'Not specified'}
- Other Constraints: ${otherConstraints || 'None'}

Rules:
1. Assign classes to available rooms and time slots from the System-Wide lists.
2. Do not schedule overlapping classes for the courses listed (assume they are for one student or a single cohort).
3. Try to honor all student preferences (preferred days, slots) as much as possible. If a direct conflict exists, prioritize fitting in the courses.
4. If specific sections for courses are not provided, you can assign a placeholder like 'S1', 'S2' etc.
5. If specific teachers for courses are not provided, you can assign a placeholder like 'Faculty TBD' or make a reasonable assignment based on typical university structures if possible. Ensure assigned teachers are sensible for the course subjects.
6. The courseName should be descriptive (e.g., "Introduction to Programming", "Calculus I").
7. The courseCode should be a typical university course code (e.g., "CSE101", "MAT110").

Output Format:
Return a JSON array of objects. Each object represents a single class session and must have the following fields: "day" (string, one of the System-Wide Available Days), "timeSlot" (string, one of the System-Wide Available Time Slots), "room" (string, one of the System-Wide Available Rooms), and "classInfo" (an object with "courseCode": string, "courseName": string, "teacher": string, "section": string).

Example of a single entry in the JSON array:
{
  "day": "Monday",
  "timeSlot": "08:30 AM - 10:00 AM",
  "room": "AB1-101",
  "classInfo": {
    "courseCode": "CSE111",
    "courseName": "Computer Fundamentals",
    "teacher": "Mr. Anis",
    "section": "SA"
  }
}

If no schedule can be reasonably generated based on the inputs, return an empty array.
Generate the schedule now.
    `;
  };

  const handleGenerateSchedule = async () => {
    if (!process.env.API_KEY) {
      setError("API Key is not configured. Please contact support.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuggestedSchedule(null);

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
      const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
      const match = jsonStr.match(fenceRegex);
      if (match && match[2]) {
        jsonStr = match[2].trim();
      }

      const parsedData = JSON.parse(jsonStr);
      if (Array.isArray(parsedData)) {
        setSuggestedSchedule(parsedData as SuggestedClassEntry[]);
      } else {
        throw new Error("Invalid schedule format received from AI.");
      }

    } catch (e: any) {
      console.error("Error generating schedule:", e);
      setError(`Failed to generate schedule: ${e.message || 'Unknown error'}. Please try refining your preferences or try again later.`);
      setSuggestedSchedule(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-2 bg-white p-4 sm:p-6 rounded-lg shadow-xl h-full flex flex-col">
      <h2 className="text-2xl sm:text-3xl font-bold text-teal-700 mb-2">Smart Scheduler</h2>
      <p className="text-sm text-gray-600 mb-6">Let AI help you plan your perfect semester! Provide your preferences below.</p>

      <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 space-y-8">
        <section aria-labelledby="preferences-title">
          <h3 id="preferences-title" className="text-xl font-semibold text-teal-600 mb-3">Your Preferences</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Days</label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map(day => (
                  <button
                    key={day}
                    onClick={() => handleDayToggle(day)}
                    className={`px-3 py-1.5 text-xs rounded-md border transition-colors
                      ${preferredDays.includes(day)
                        ? 'bg-teal-500 text-white border-teal-500'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300'
                      }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Time Slots</label>
              <div className="flex flex-wrap gap-2">
                {FALLBACK_TIME_SLOTS.map(slot => ( // Offer system-wide slots for preference selection
                  <button
                    key={slot}
                    onClick={() => handleTimeSlotToggle(slot)}
                    className={`px-3 py-1.5 text-xs rounded-md border transition-colors
                      ${preferredTimeSlots.includes(slot)
                        ? 'bg-teal-500 text-white border-teal-500'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300'
                      }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="courses" className="block text-sm font-medium text-gray-700 mb-1">
                Desired Courses
                <span className="text-xs text-gray-500 ml-1">(e.g., CSE101, MAT110 Intro to Calculus)</span>
              </label>
              <textarea
                id="courses"
                value={courses}
                onChange={e => setCourses(e.target.value)}
                rows={1}
                className="w-full p-1 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 text-xs"
                placeholder="List course codes and/or names, comma-separated"
              />
            </div>

            <div>
              <label htmlFor="faculty" className="block text-sm font-medium text-gray-700 mb-1">
                Preferred Faculty
                <span className="text-xs text-gray-500 ml-1">(Optional)</span>
              </label>
              <textarea
                id="faculty"
                value={faculty}
                onChange={e => setFaculty(e.target.value)}
                rows={1}
                className="w-full p-1 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 text-xs"
                placeholder="List preferred faculty names, comma-separated"
              />
            </div>

            <div>
              <label htmlFor="otherConstraints" className="block text-sm font-medium text-gray-700 mb-1">
                Other Constraints
                 <span className="text-xs text-gray-500 ml-1">(e.g., No classes before 9 AM, prefer labs in afternoon)</span>
              </label>
              <textarea
                id="otherConstraints"
                value={otherConstraints}
                onChange={e => setOtherConstraints(e.target.value)}
                rows={1}
                className="w-full p-1 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 text-xs"
                placeholder="Any other notes for the scheduler"
              />
            </div>
          </div>
        </section>

        <div className="pt-2 pb-4">
          <button
            onClick={handleGenerateSchedule}
            disabled={isLoading}
            className="w-full sm:w-auto flex items-center justify-center px-6 py-2.5 bg-teal-600 text-white font-medium rounded-md shadow-md hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </>
            ) : (
              "Generate My Schedule with AI"
            )}
          </button>
        </div>

        {error && (
          <div className="my-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-md text-sm" role="alert">
            <p className="font-semibold">Error</p>
            <p>{error}</p>
          </div>
        )}

        {suggestedSchedule && !isLoading && (
          <section aria-labelledby="suggested-schedule-title" className="mt-6">
            <h3 id="suggested-schedule-title" className="text-xl font-semibold text-teal-600 mb-3">Suggested Schedule</h3>
            {suggestedSchedule.length > 0 ? (
              <ul className="space-y-3">
                {suggestedSchedule.map((entry, index) => (
                  <li key={index} className="p-3 bg-gray-50 border border-gray-200 rounded-md shadow-sm hover:shadow-md transition-shadow">
                    <p className="font-semibold text-teal-700">{entry.classInfo.courseName} <span className="text-gray-600">({entry.classInfo.courseCode})</span></p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">{entry.day}</span> at {entry.timeSlot}
                    </p>
                    <p className="text-sm text-gray-600">Room: {entry.room}</p>
                    <p className="text-sm text-gray-600">Teacher: {entry.classInfo.teacher}</p>
                    <p className="text-sm text-gray-600">Section: {entry.classInfo.section}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 italic text-center py-4">
                The AI couldn't generate a schedule based on your current preferences, or no classes fit the criteria. Try adjusting your preferences or adding more courses.
              </p>
            )}
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                    onClick={handleGenerateSchedule} 
                    disabled={isLoading}
                    className="w-full sm:w-auto px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 disabled:bg-gray-300"
                >
                    {isLoading ? "Generating..." : "Generate Again"}
                </button>
                 <button
                    onClick={() => {
                        setSuggestedSchedule(null);
                        setError(null);
                    }}
                    className="w-full sm:w-auto px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                >
                    Refine Preferences
                </button>
            </div>
          </section>
        )}
         {!isLoading && !suggestedSchedule && !error && (
            <div className="text-center py-10 px-3 text-gray-500 bg-gray-50 rounded-md flex flex-col justify-center items-center shadow-inner mt-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto mb-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
                <p className="text-md font-semibold mb-1">Your AI-generated schedule will appear here.</p>
                <p className="text-xs">Fill in your preferences above and click "Generate My Schedule".</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default SmartSchedulerView;