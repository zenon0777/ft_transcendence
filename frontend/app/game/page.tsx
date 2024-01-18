"use client"
import { useContext, useEffect, useState } from "react";
import { GameContext, gameSocketContext } from "../context/gameSockets";
import { matchInfo } from "./types/interfaces";
import { useRouter } from "next/navigation";

function GameQueue() {

    const   router = useRouter();
    const   [progress, setProgress] = useState<number>(5);
    const gameSocket = useContext(gameSocketContext)
    const   {setScore,setGameMape, setPowerUps, setData, setGameId, setPlayerL, setPlayerR, gameType, setGameType, settings, setSettings} = useContext(GameContext);

    useEffect(() => {
        const handleGameReady = (data: {roomId: string}) => {
            setProgress(100);
            // console.log('emit match ready');            
            // setGameType('QUEUE');
            // setData(data);
            // setGameId(data[0].roomId);
            // setPlayerL({name: data[0].nickname, picture: data[0].profilePic});
            // setPlayerR({name: data[1].nickname, picture: data[1].profilePic});
            router.push(`/game/${data.roomId}`);
        };

        // const handlePlayerSettings = (data: any) => {
        //     console.log('data front lop: ', data);
        //     setSettings({theme: data.theme, power: data.power, id: data.id, powerOpponenent: data.powerOpponenent});
        // };

        gameSocket.on('MatchReady', handleGameReady);
        // gameSocket.on('playerSettings', handlePlayerSettings);
        
        return () => {
            gameSocket.off('MatchReady');
            // gameSocket.off('playerSettings');
        };
    },[]);
    
    useEffect(() => {
        gameSocket.emit('abort');
        gameSocket.on('readyToQueue', () => {
            console.log('ready to enter queue')
            setScore({playerL: 0, playerR: 0});
            gameSocket.emit('PlayQueue');
        })
        // gameSocket.emit('PlayQueue');
        gameSocket.on('userInQueue', () => {
            console.log('user is ready emit')
            gameSocket.emit('ImReady');
        })
        
        const timer = setInterval(() => {
            setProgress((prevProgress) => (prevProgress < 90 ? prevProgress + 5 : prevProgress));
        }, 900);
    
        return () => {
            clearInterval(timer);
            gameSocket.off('userInQueue')
            gameSocket.off('readyToQueue')
        };

    }, []);

    return (
        <main className="main flex bg-cyan-900 justify-center items-center h-screen w-screen">
            <div className="bg-cyan-100 h-[93.75%] w-[95.83%] flex space-x-[0.87%] items-end justify-center rounded-[15px]">
                <div 
                className={`bg-black flex flex-col w-full  items-center relative rounded-[10px] transition-all duration-1000 ease-in-out bottom-0`}
                style={{ height: `${progress}%` }}>
                    <h1 className="text-red-600 text-3xl self-center">{`${progress}%`}</h1>
                </div>
            </div>
        </main>
    );
};

export default GameQueue;