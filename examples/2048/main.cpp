#include "Engine.h"

struct Game2048 : Screen
{
	Game2048()
	{
		entities.push_back(Entity::fillCircle(Vector2(50.0f, 50.0f), 30.0f, 0xFF88AAFF));

		rootComponent = std::shared_ptr<struct Component>(new struct Component(entities));
		rootComponent->setRelativeSize(entities, Vector2(1.0f, 1.0f));

		auto boardBG = std::shared_ptr<RoundedRectangleComponent>(
			new RoundedRectangleComponent(
				entities,
				10.0f,
				0.0f,
				0x0f,
				0x00FF00FF
		));
		boardBG->sizeMode = Component::SizeMode_FixedAspectRatio;
		boardBG->aspectRatio = 1.0f;
		boardBG->setRelativeSize(entities, Vector2(1.0f, 1.0f));
		boardBG->setOffsetSize(entities, Vector2(-100.0f, -100.0f));
		boardBG->setRelativePosition(entities, Vector2(0.5f, 0.5f));
		boardBG->setAnchorPoint(entities, Vector2(0.5f, 0.5f));

		for (int32_t i = 0; i < 4; ++i)
		{
			for (int32_t j = 0; j < 4; ++j)
			{
				auto tile = std::shared_ptr<RoundedRectangleComponent>(
					new RoundedRectangleComponent(
						entities,
						5.0f,
						0.0f,
						0x0f,
						0x0000FFFF
				));
				tile->setRelativeSize(entities, Vector2(0.95/4.0, 0.95/4.0));
				tile->setOffsetSize(entities, Vector2(0.0f, 0.0f));
				tile->setRelativePosition(entities, Vector2(i*0.95/4.0 + 0.01*(i+1), j*0.95/4.0 + 0.01f*(j+1)));
				tile->setOffsetPosition(entities, Vector2(0.0f, 0.0f));
				//tile->setAnchorPoint(entities, Vector2(0.5f, 0.5f));
				boardBG->addChild(entities, tile);
			}
		}

		rootComponent->addChild(entities, boardBG);
	}
};

std::function<void()> loop;
void main_loop() { loop(); }

int main()
{
	Game game;
	std::shared_ptr<Screen> game2048 = std::shared_ptr<Screen>(new Game2048());
	game.setScreen(game2048);

	int32_t mode = 0;
	loop = [&]
	{
		int32_t newMode = Engine_GetMode();
		if (newMode != mode)
		{
			printf("New mode: %d\n", newMode);
			mode = newMode;
			switch (mode)
			{
				case 0:
				{
					game.setScreen(game2048);
					break;
				}
			}
		}
		game.loop();
	};

	emscripten_set_main_loop(main_loop, 0, true);

	return 1;
}