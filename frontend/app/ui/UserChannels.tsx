
import type { FC } from 'react';
import ChannelComponent from './channelComponent';
// import { channels } from './ChatConstants';
import { ChannelInter } from '../interfaces/interfaces';

interface UserChannelsProps {
	channels: ChannelInter[] | undefined;
}

const UserChannels: FC<UserChannelsProps> = ({channels}) => {
		return (
			<>
				{
				  (channels && channels.length > 0) && (
					channels.map((channel) => (
					  <ChannelComponent
						key={channel.channelId} // Add a unique key for each child component
						channel={channel}
					  />
					))
				  )
				}
				{
					(channels && channels.length === 0) && (
						<div className='flex w-full h-full flex-crol justify-center items-center'>
							<p className='text-center text-lg font-bold text-teal-200'>Join Or Create Your Own Channel</p>
						</div>
					)
				}
			</>
	);
}
export default UserChannels;
