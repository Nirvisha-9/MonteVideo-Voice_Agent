import React, { createContext, useContext, useState } from 'react';

/**
 * @typedef {Object} UserContextType
 * @property {?Object} user - The current user object, or null if not authenticated.
 * @property {Function} setUser - Function to update the current user.
 */

/**
 * Creates a React context for managing and accessing user data throughout the application.
 * 
 * @type {React.Context<UserContextType>}
 */
const UserContext = createContext();

/**
 * Provides the UserContext to its children components.
 * 
 * @component
 * @param {Object} props - The properties object.
 * @param {React.ReactNode} props.children - The children components that will have access to the UserContext.
 * @returns {React.ReactElement} The context provider wrapping the children components.
 */
export const UserProvider = ({ children }) => {
    const [user, setUser] = useState(null);

    return (
        <UserContext.Provider value={{ user, setUser }}>
            {children}
        </UserContext.Provider>
    );
};

/**
 * Custom hook to access the UserContext.
 * 
 * @returns {UserContextType} The current user context value, including the user and setUser function.
 * 
 * @throws {Error} If used outside of a UserProvider.
 */
export const useUserContext = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error("useUserContext must be used within a UserProvider");
    }
    return context;
};
