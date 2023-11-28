import { BellAlertIcon } from "@heroicons/react/24/outline";
import { NotificationsData } from "../Dashboard/page"
import { useEffect, useState } from 'react';
import io from 'socket.io-client';
import clsx from "clsx";

interface NotificationsProps  {
    handleNotification: (NotificationsData: NotificationsData) => void;
}

const Notifications = ({ handleNotification } : NotificationsProps) => {
    const [notifications, setNotifications] = useState<NotificationsData[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notificationNumber, setNotificationNumber] = useState(0);
    const [newNotification, setNewNotification] = useState<NotificationsData | null>(null);
    const socket = io("http://localhost:8000");

    const knotifications = [{
        userId: "1",
        description: "You have a new friend request from user 2",
    },
    {
        userId: "2",
        description: "You have a new friend request from user 3",
    },];

    const handleNewNotification = (data: NotificationsData) => {
        setNewNotification(data);
        setNotificationNumber(notificationNumber + 1);

    }

    useEffect(() => {
        socket.on("notifHistory", (data: NotificationsData) => {
            setNotifications((prevNotifications) => {
                return [...prevNotifications, data];
            });
            handleNewNotification(data);
        });
    }, []);

    return (
        <div className="notifications relative">

            <BellAlertIcon onClick={()=>{setShowNotifications(!showNotifications)}} className= "h-15 hidden lg:flex w-10 p-2 bg-gray-100 rounded-full"/>
            <span className={clsx(`absolute text-s text-white font-bold rounded-full h-5 w-5 flex items-center justify-center bottom-0 right-0 transform translate-x-[8px]`
            , {'hidden' : showNotifications},
            {
                'bg-red-500 ' : (notificationNumber > 0),
                'bg-gray-500' : (notificationNumber === 0),})}>{notificationNumber}
            </span>
            <ul className={`absolute bg-white rounded-md shadow-md p-2 top-10 right-0 w-60 h-60 overflow-y-scroll styled-scrollbar ${showNotifications ? '' : 'hidden'}`}>
                {showNotifications && knotifications.map((notification) => {
                    return (
                        <li key={notification.userId}>
                            <p>{notification.description}</p>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export default Notifications;