#include "Engine.h"

struct TestPrimitives : Screen
{
	TestPrimitives()
	{
		printf("initializing TestPrimitives\n");
		entities.push_back(Entity::fillCircle(Vector2(50.0f, 50.0f), 30.0f, 0xFF88AAFF));
		entities.push_back(Entity::rectangle(Vector2(150.0f, 50.0f), Vector2(40.0f, 80.0f), 0xBB88FFFF));
		//entities.push_back(Entity::fillCircle(Vector2(50.0f, 150.0f), 2.0f, 0x999999FF));
		for (int32_t i = 1; i <= 5; ++i)
		{
			Entity textEntity = Entity::text(
				"Hello!",
				Vector2(50.0f, 120.0f + i*50.0f),
				i*10.0f,
				0xFFFFFFFF
			);
			printf("rectangle size: %4.2f x %4.2f\n", textEntity.coord3.x, textEntity.coord3.y);
			entities.push_back(Entity::rectangle(
				textEntity.coord1,
				textEntity.coord3,
				0xBB88FFFF
			));
			entities.push_back(textEntity);
		}

		entities.push_back(Entity::roundedRectangle(
			Vector2(250.0f, 50.0f),
			Vector2(100.0f, 200.0f),
			15.0f,
			5.0f,
			0xFFFFFFFF,
			0x55FFBBFF
		));
	}
};

struct TestTextLabel : Screen
{
	TestTextLabel()
	{
		printf("initializing TestTextLabel\n");
		entities.push_back(Entity::fillCircle(Vector2(50.0f, 50.0f), 30.0f, 0x99FF99FF));
		printf("1\n");
		rootComponent = std::shared_ptr<struct Component>(new RectangleComponent(entities, 0xFFFFFFFF));
		printf("2\n");
		rootComponent->setRelativeSize(entities, Vector2(0.5f, 0.5f));
		rootComponent->setRelativePosition(entities, Vector2(0.5f, 0.5f));
		rootComponent->setAnchorPoint(entities, Vector2(0.5f, 0.5f));

		printf("3\n");

		auto ulText = std::shared_ptr<struct Component>(new TextComponent(entities, "Hello World!", 0x0000FFFF, 20.0f));
		rootComponent->addChild(entities, ulText);

		auto urText = std::shared_ptr<struct Component>(new TextComponent(entities, "Hello World!", 0x0000FFFF, 20.0f));
		urText->setRelativePosition(entities, Vector2(1.0f, 0.0f));
		urText->setAnchorPoint(entities, Vector2(1.0f, 0.0f));
		rootComponent->addChild(entities, urText);

		auto blText = std::shared_ptr<struct Component>(new TextComponent(entities, "Hello World!", 0x0000FFFF, 20.0f));
		blText->setRelativePosition(entities, Vector2(0.0f, 1.0f));
		blText->setAnchorPoint(entities, Vector2(0.0f, 1.0f));
		rootComponent->addChild(entities, blText);

		auto brText = std::shared_ptr<struct Component>(new TextComponent(entities, "Hello World!", 0x0000FFFF, 20.0f));
		brText->setRelativePosition(entities, Vector2(1.0f, 1.0f));
		brText->setAnchorPoint(entities, Vector2(1.0f, 1.0f));
		rootComponent->addChild(entities, brText);

		auto cText = std::shared_ptr<struct Component>(new TextComponent(entities, "Hello World!", 0x0000FFFF, 20.0f));
		cText->setRelativePosition(entities, Vector2(0.5f, 0.5f));
		cText->setAnchorPoint(entities, Vector2(0.5f, 0.5f));
		rootComponent->addChild(entities, cText);
	}
};

struct TestEntityGrid : Screen
{
	TestEntityGrid()
	{
		printf("initializing TestEntityGrid\n");
		entities.push_back(Entity::fillCircle(Vector2(50.0f, 50.0f), 30.0f, 0x66AAFFFF));
		rootComponent = std::shared_ptr<struct Component>(new EntityGrid(
			entities,
			Vector2Int(20, 30)
		));
		rootComponent->sizeMode = Component::SizeMode_FixedAspectRatio;
		rootComponent->setRelativeSize(entities, Vector2(1.0f, 1.0f));
		rootComponent->setOffsetSize(entities, Vector2(-10.0f, -10.0f));
		rootComponent->setRelativePosition(entities, Vector2(0.5f, 0.5f));
		rootComponent->setAnchorPoint(entities, Vector2(0.5f, 0.5f));
	}
};

struct TestDraggable : Screen
{
	TestDraggable()
	{
		printf("initializing TestDraggable\n");
		entities.push_back(Entity::fillCircle(Vector2(50.0f, 50.0f), 30.0f, 0xFF00FFFF));
		rootComponent = std::shared_ptr<struct Component>(new struct Component(entities));
		rootComponent->setRelativeSize(entities, Vector2(1.0f, 1.0f));

		auto dragAnywhere = std::shared_ptr<struct Component>(new RectangleComponent(entities, 0xFFFFFFFF));
		dragAnywhere->setRelativePosition(entities, Vector2(0.85f, 0.85f));
		dragAnywhere->setAnchorPoint(entities, Vector2(0.5f, 0.5f));
		dragAnywhere->setOffsetSize(entities, Vector2(80.0f, 80.0f));
		dragAnywhere->enableDragging(nullptr);

		auto dragHorizontal = std::shared_ptr<struct Component>(new RectangleComponent(entities, 0xAAFFCCFF));
		dragHorizontal->setRelativePosition(entities, Vector2(0.25f, 0.25f));
		dragHorizontal->setAnchorPoint(entities, Vector2(0.5f, 0.5f));
		dragHorizontal->setOffsetSize(entities, Vector2(80.0f, 80.0f));
		dragHorizontal->enableDragging([](Vector2& offsetPosition){
			offsetPosition.y = 0;
		});

		auto dragVertical = std::shared_ptr<struct Component>(new RectangleComponent(entities, 0xAACCFFFF));
		dragVertical->setRelativePosition(entities, Vector2(0.25f, 0.75f));
		dragVertical->setAnchorPoint(entities, Vector2(0.5f, 0.5f));
		dragVertical->setOffsetSize(entities, Vector2(80.0f, 80.0f));
		dragVertical->enableDragging([](Vector2& offsetPosition){
			offsetPosition.x = 0;
		});

		auto ring = std::shared_ptr<StrokeCircleComponent>(new StrokeCircleComponent(entities, 150.0f, 5.0f, 0xAACCFFFF));
		ring->setRadius(entities, 150.0f, 0.0f);
		ring->setRelativePosition(entities, Vector2(0.5f, 0.5f));
		ring->setAnchorPoint(entities, Vector2(0.5f, 0.5f));

		auto dragCircle = std::shared_ptr<FillCircleComponent>(new FillCircleComponent(entities, 0xAACCFFFF));
		dragCircle->setRadius(entities, 50.0f, 0.0f);
		dragCircle->setRelativePosition(entities, Vector2(0.5f, 0.5f));
		dragCircle->setAnchorPoint(entities, Vector2(0.5f, 0.5f));
		//dragCircle->setOffsetSize(entities, Vector2(100.0f, 100.0f));
		dragCircle->setOffsetPosition(entities, Vector2(0.0f, 150.0f));
		dragCircle->enableDragging([](Vector2& offsetPosition){
			float r = 150.0f;
			float x = offsetPosition.x;
			float y = offsetPosition.y;
			offsetPosition.x = r*x/sqrtf(x*x+y*y);
			offsetPosition.y = r*y/sqrtf(x*x+y*y);
			printf("clamped position: %4.2f x %4.2f\n", offsetPosition.x, offsetPosition.y);
		});

		rootComponent->addChild(entities, dragAnywhere);
		rootComponent->addChild(entities, dragHorizontal);
		rootComponent->addChild(entities, dragVertical);
		rootComponent->addChild(entities, ring);
		rootComponent->addChild(entities, dragCircle);
	}
};

struct CustomButton : Component
{
	std::function<void(const Vector2&, CustomButton*)> inOnClick;

	CustomButton(std::vector<Entity>& entities, std::function<void(const Vector2&, CustomButton*)> inOnClick)
	: Component(entities)
	, inOnClick(inOnClick)
	{
		auto bg = std::shared_ptr<RoundedRectangleComponent>(new RoundedRectangleComponent(
			entities, 10.0f, 2.0f, 0xAAAAAAFF, 0xFFFFFFFF));
		bg->setRelativePosition(entities, Vector2(0.0f, 0.0f));
		bg->setRelativeSize(entities, Vector2(1.0f, 1.0f));

		auto fg = std::shared_ptr<RoundedRectangleComponent>(new RoundedRectangleComponent(
			entities, 10.0f, 2.0f, 0xAAAAAAFF, 0xFFFFFFFF));
		fg->setRelativePosition(entities, Vector2(0.0f, 0.0f));
		fg->setRelativeSize(entities, Vector2(1.0f, 1.0f));
		fg->setOffsetPosition(entities, Vector2(5.0f, 5.0f));

		enableClicking([&entities, fg](){
			printf("selecting!\n");
			fg->setOffsetPosition(entities, Vector2(2.0f, 2.0f));
			fg->relayout(entities);
		}, [&entities, fg](){
			printf("deselecting!\n");
			fg->setOffsetPosition(entities, Vector2(5.0f, 5.0f));
			fg->relayout(entities);
		}, [this](const Vector2& position){
			if (this->inOnClick)
			{
				this->inOnClick(position, this);
			}
		});

		addChild(entities, bg);
		addChild(entities, fg);
	}
};

struct TestClickable : Screen
{
	TestClickable()
	{
		printf("initializing TestDraggable\n");
		entities.push_back(Entity::fillCircle(Vector2(50.0f, 50.0f), 30.0f, 0xFFCCAAFF));
		rootComponent = std::shared_ptr<struct Component>(new struct Component(entities));
		rootComponent->setRelativeSize(entities, Vector2(1.0f, 1.0f));

		auto button1 = std::shared_ptr<FillCircleComponent>(new FillCircleComponent(entities, 0xAACCFFFF));
		button1->setRadius(entities, 50.0f, 0.0f);
		button1->setRelativePosition(entities, Vector2(1.0f, 0.0f));
		button1->setOffsetPosition(entities, Vector2(-100.0f, 100.0f));
		button1->setAnchorPoint(entities, Vector2(0.5f, 0.5f));
		button1->enableClicking([this, button1](){
			printf("selecting!\n");
			button1->setRadius(entities, 75.0f, 0.0f);
			button1->relayout(entities);
		}, [this, button1](){
			printf("deselecting!\n");
			button1->setRadius(entities, 50.0f, 0.0f);
			button1->relayout(entities);
		}, [this, button1](const Vector2&){
			printf("click!\n");
			button1->setColor(entities, 0x298347FF);
			button1->relayout(entities);
		});

		auto button2 = std::shared_ptr<RoundedRectangleComponent>(new RoundedRectangleComponent(
			entities, 10.0f, 5.0f, 0xFFFFFFFF, 0x33CC00FF));
		button2->setOffsetSize(entities, Vector2(150.0f, 80.0f));
		button2->setRelativePosition(entities, Vector2(1.0f, 0.0f));
		button2->setOffsetPosition(entities, Vector2(-200.0f, 300.0f));
		button2->setAnchorPoint(entities, Vector2(0.0f, 0.5f));
		button2->enableClicking([this, button2](){
			printf("selecting!\n");
			button2->setOffsetSize(entities, Vector2(250.0f, 80.0f));
			button2->relayout(entities);
		}, [this, button2](){
			printf("deselecting!\n");
			button2->setOffsetSize(entities, Vector2(150.0f, 80.0f));
			button2->relayout(entities);
		}, [this, button2](const Vector2&){
			printf("click!\n");
			button2->setFillColor(entities, 0x298347FF);
			button2->relayout(entities);
		});

		auto button3 = std::shared_ptr<CustomButton>(new CustomButton(entities, nullptr));
		button3->setOffsetSize(entities, Vector2(150.0f, 80.0f));
		button3->setRelativePosition(entities, Vector2(0.5f, 0.5f));
		button3->setAnchorPoint(entities, Vector2(0.5f, 0.5f));

		rootComponent->addChild(entities, button1);
		rootComponent->addChild(entities, button2);
		rootComponent->addChild(entities, button3);
	}
};

struct TestPooling : Screen
{
	std::shared_ptr<FixedCapacityPool> pool;
	TestPooling()
	{
		printf("initializing TestPooling\n");

		entities.push_back(Entity::fillCircle(Vector2(50.0f, 50.0f), 30.0f, 0x990000FF));
		rootComponent = std::shared_ptr<struct Component>(new struct Component(entities));
		rootComponent->setRelativeSize(entities, Vector2(1.0f, 1.0f));

		pool.reset(new FixedCapacityPool(
			entities,
			5,
			rootComponent,
			[this](){
				return new CustomButton(entities, [this](const Vector2&, CustomButton* button){
					button->disable(entities);
				});
			}
		));

		rootComponent->enableClicking(nullptr, nullptr, [this](const Vector2& position){
			printf("Click! %4.2f x %4.2f\n", position.x, position.y);
			if (auto button = pool->get(entities))
			{
				button->setOffsetSize(entities, Vector2(150.0f, 80.0f));
				button->setAnchorPoint(entities, Vector2(0.5f, 0.5f));
				button->setOffsetPosition(entities, position);
				button->relayout(entities);
			}
		});
	}
};

struct TestAnimation : Screen
{
	TestAnimation()
	{
		printf("initializing TestAnimation\n");

		entities.push_back(Entity::fillCircle(Vector2(50.0f, 50.0f), 30.0f, 0x999900FF));

		rootComponent = std::shared_ptr<struct Component>(new struct Component(entities));
		rootComponent->setRelativeSize(entities, Vector2(1.0f, 1.0f));

		auto circle1 = std::shared_ptr<FillCircleComponent>(new FillCircleComponent(entities, 0xAACCFFFF));
		circle1->setRadius(entities, 50.0f, 0.0f);
		circle1->setRelativePosition(entities, Vector2(0.0f, 0.0f));
		circle1->setOffsetPosition(entities, Vector2(200.0f, 200.0f));
		circle1->setAnchorPoint(entities, Vector2(0.5f, 0.5f));

		auto animation1 = std::shared_ptr<SpringAnimation>(new SpringAnimation(
			circle1,
			SpringAnimation::OffsetPosition,
			Vector2(600.0f, 400.0f),
			1000.0f,
			100.0f,
			0.001f
		));
		circle1->movement = animation1;

		auto circle2 = std::shared_ptr<FillCircleComponent>(new FillCircleComponent(entities, 0xFFAAFFFF));
		circle2->setRadius(entities, 50.0f, 0.0f);
		circle2->setRelativePosition(entities, Vector2(1.0f, 0.0f));
		circle2->setOffsetPosition(entities, Vector2(-400.0f, 300.0f));
		circle2->setAnchorPoint(entities, Vector2(0.5f, 0.5f));

		auto animation2 = std::shared_ptr<SpringAnimation>(new SpringAnimation(
			circle2,
			SpringAnimation::OffsetSize,
			Vector2(150.0f, 150.0f),
			1000.0f,
			100.0f,
			0.001f
		));
		circle2->movement = animation2;

		auto circle3 = std::shared_ptr<FillCircleComponent>(new FillCircleComponent(entities, 0xAAFFAAFF));
		circle3->setRadius(entities, 30.0f, 0.0f);
		circle3->setRelativePosition(entities, Vector2(0.5f, 0.0f));
		circle3->setOffsetPosition(entities, Vector2(0.0f, 100.0f));
		circle3->setAnchorPoint(entities, Vector2(0.5f, 0.5f));

		auto animation3a = std::shared_ptr<SpringAnimation>(new SpringAnimation(
			circle3,
			SpringAnimation::OffsetPosition,
			Vector2(-400.0f, 300.0f),
			1000.0f,
			100.0f,
			0.001f
		));
		auto animation3b = std::shared_ptr<SpringAnimation>(new SpringAnimation(
			circle3,
			SpringAnimation::OffsetSize,
			Vector2(150.0f, 150.0f),
			1000.0f,
			100.0f,
			0.001f
		));
		auto animation3 = std::shared_ptr<ComposeMovement>(new ComposeMovement());
		animation3->movements.push_back(animation3a);
		animation3->movements.push_back(animation3b);
		circle3->movement = animation3;

		rootComponent->addChild(entities, circle1);
		rootComponent->addChild(entities, circle2);
		rootComponent->addChild(entities, circle3);
	}
};

std::function<void()> loop;
void main_loop() { loop(); }

int main()
{
	printf("jhelms\n");
	Game game;
	//game.entities.push_back(Entity::fillCircle(Vector2(50.0f, 50.0f), 30.0f, 0xFF88AAFF));
	std::shared_ptr<Screen> testPrimitives = std::shared_ptr<Screen>(new TestPrimitives());
	std::shared_ptr<Screen> testTextLabel = std::shared_ptr<Screen> (new TestTextLabel());
	std::shared_ptr<Screen> testEntityGrid = std::shared_ptr<Screen> (new TestEntityGrid());
	std::shared_ptr<Screen> testDraggable = std::shared_ptr<Screen> (new TestDraggable());
	std::shared_ptr<Screen> testClickable = std::shared_ptr<Screen> (new TestClickable());
	std::shared_ptr<Screen> testPooling = std::shared_ptr<Screen> (new TestPooling());
	std::shared_ptr<TestAnimation> testAnimation = std::shared_ptr<TestAnimation> (new TestAnimation());
	game.setScreen(testPrimitives);


	double lastTime = emscripten_get_now();

	int32_t mode = 0;
	loop = [&]
	{
		double currentTime = emscripten_get_now();
		float deltaTime = currentTime - lastTime;
		lastTime = currentTime;
		int32_t newMode = Engine_GetMode();
		if (newMode != mode)
		{
			printf("New mode: %d\n", newMode);
			mode = newMode;
			switch (mode)
			{
				case 0:
				{
					game.setScreen(testPrimitives);
					break;
				}
				case 1:
				{
					game.setScreen(testTextLabel);
					break;
				}
				case 2:
				{
					game.setScreen(testEntityGrid);
					break;
				}
				case 3:
				{
					game.setScreen(testDraggable);
					break;
				}
				case 4:
				{
					game.setScreen(testClickable);
					break;
				}
				case 5:
				{
					game.setScreen(testPooling);
					break;
				}
				case 6:
				{
					game.setScreen(testAnimation);
					break;
				}
			}
		}
		game.loop();
	};

	emscripten_set_main_loop(main_loop, 0, true);

	return 1;
}